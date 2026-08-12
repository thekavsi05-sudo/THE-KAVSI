import mongoose from 'mongoose';
import Order, { ORDER_STATUS_VALUES } from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import generateOrderId from '../utils/generateOrderId.js';
import { priceCart } from '../utils/pricing.js';
import { verifyRazorpaySignature } from '../utils/razorpayClient.js';
import { checkPaymentIntent } from './paymentController.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import escapeRegex from '../utils/escapeRegex.js';
import { sendNotificationToPhone } from './notificationController.js';

const CANCELLABLE_STATUSES = ['Pending', 'Confirmed', 'Packed'];

// Bug 31: how long (from order creation) a customer may self-cancel, on top
// of the status check above. Configurable via env; defaults to 2 hours if
// unset so behavior is sane even without a .env change.
function getCancellationWindowMinutes() {
  const raw = Number(process.env.ORDER_CANCELLATION_WINDOW_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

// Valid order-status transitions. Anything not listed as a value for the
// current status is rejected -- this stops accidents like
// Delivered -> Pending or Cancelled -> Shipped from a stray admin click.
const ALLOWED_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Out for Delivery', 'Delivered'],
  'Out for Delivery': ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
// POST /api/orders/price
// Calculates the current backend-authoritative checkout total
// without creating an order or changing stock.

function getOrderStatusNotification(status, orderId) {
  const notifications = {
    Confirmed: {
      title: 'THE KAVSI - Order Confirmed',
      body: `Your order ${orderId} has been confirmed.`,
    },

    Packed: {
      title: 'THE KAVSI - Order Packed',
      body: `Your order ${orderId} has been packed and is ready for dispatch.`,
    },

    Shipped: {
      title: 'THE KAVSI - Order Shipped',
      body: `Your order ${orderId} has been shipped.`,
    },

    'Out for Delivery': {
      title: 'THE KAVSI - Out for Delivery',
      body: `Your order ${orderId} is out for delivery.`,
    },

    Delivered: {
      title: 'THE KAVSI - Order Delivered',
      body: `Your order ${orderId} has been delivered successfully.`,
    },

    Cancelled: {
      title: 'THE KAVSI - Order Cancelled',
      body: `Your order ${orderId} has been cancelled.`,
    },
  };

  return notifications[status] || null;
}
export const calculateOrderPrice = asyncHandler(async (req, res) => {
  const {
    products = [],
    couponCode,
  } = req.body;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Products are required',
    });
  }

  const {
    pricedItems,
    subtotal,
    couponDiscount,
    appliedCouponCode,
    deliveryCharge,
    totalAmount,
    unavailable,
  } = await priceCart(products, couponCode);

  if (unavailable.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Some items are no longer available',
      unavailable,
    });
  }

  res.json({
    success: true,
    data: {
      items: pricedItems,
      subtotal,
      couponDiscount,
      couponCode: appliedCouponCode,
      deliveryCharge,
      totalAmount,
    },
  });
});
// POST /api/orders
// The single most important integrity boundary in the app: re-validates and
// re-prices every line item against MongoDB, never trusts the frontend's
// numbers, and only decrements stock after everything checks out.
export const createOrder = asyncHandler(async (req, res) => {
  const {
    customerName,
    phone,
    alternatePhone,
    address,
    fullAddress,
    products,
    paymentMethod,
    couponCode,
    idempotencyKey,
    // Present only when paymentMethod === 'Razorpay' -- the values the
    // Razorpay Checkout widget hands back to the frontend on success.
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body;

  // Idempotency: if this exact checkout attempt (same key, same phone) has
  // already produced an order -- e.g. the customer double-clicked "Place
  // Order", or their network retried the request -- return the existing
  // order instead of creating a second one. Frontend-only button-disabling
  // is not enough, because a retried HTTP request never goes through the
  // button at all.
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey, phone }).lean();
    if (existing) {
      return res.status(200).json({ success: true, message: 'Order already placed', data: existing });
    }
  }

  // For online payments, verify the payment actually happened and belongs to
  // this order attempt BEFORE we touch stock or create anything. A forged or
  // missing signature here means "was never actually paid" -- reject outright
  // rather than trusting paymentMethod: 'Razorpay' at face value.
  let paymentIntent;
  if (paymentMethod === 'Razorpay') {
    const ok = verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please try again.' });
    }

    // Cross-check the payment against the PaymentIntent recorded when the
    // Razorpay order was created: same phone, same cart, same amount, not
    // already used. This is what actually stops one successful payment from
    // being replayed to create multiple orders, or a payment made for a
    // cheap cart being used to "pay" for a swapped, more expensive one.
    const { pricedItems: _preview, totalAmount: previewTotal, unavailable: previewUnavailable } =
      await priceCart(products, couponCode);
    if (previewUnavailable.length > 0) {
      return res.status(409).json({ success: false, message: 'Some items are no longer available', unavailable: previewUnavailable });
    }
    const intentCheck = await checkPaymentIntent({
      razorpayOrderId,
      phone,
      products,
      couponCode,
      totalAmountPaise: Math.round(previewTotal * 100),
    });
    if (!intentCheck.ok) {
      return res.status(409).json({ success: false, message: intentCheck.message });
    }
    paymentIntent = intentCheck.intent;
  }

  const session = await mongoose.startSession();
  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const { pricedItems, subtotal, couponDiscount, appliedCouponCode, deliveryCharge, totalAmount, unavailable } =
        await priceCart(products, couponCode, session);

      if (unavailable.length > 0) {
        const err = new Error('Some items are no longer available in the requested quantity');
        err.statusCode = 409;
        err.unavailable = unavailable;
        throw err;
      }

      // Decrement stock atomically per variant, guarded by a stock >= qty
      // filter so a race between two simultaneous orders can't oversell.
      for (const item of pricedItems) {
        const result = await Product.updateOne(
          { _id: item.productId, variants: { $elemMatch: { size: item.size, color: item.color, stock: { $gte: item.quantity } } } },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session }
        );
        if (result.modifiedCount === 0) {
          const err = new Error(`${item.name} (${item.color}/${item.size}) sold out during checkout`);
          err.statusCode = 409;
          err.unavailable = [{ ...item, reason: 'Sold out during checkout', availableStock: 0 }];
          throw err;
        }
      }

      if (appliedCouponCode) {
        // Atomic, conditional increment: only succeeds if the coupon is still
        // under its usage limit (or unlimited) at the moment of the write.
        // priceCart() already checked this a few lines up, but re-checking
        // here with a filter closes the window between "we read usedCount"
        // and "we incremented it" -- the actual scenario Bug 8 describes,
        // where two customers redeem the last use of a coupon at once.
        const couponUpdate = await Coupon.updateOne(
          {
            code: appliedCouponCode,
            $or: [{ usageLimit: { $lte: 0 } }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
          },
          { $inc: { usedCount: 1 } },
          { session }
        );
        if (couponUpdate.modifiedCount === 0) {
          const err = new Error('This coupon has just reached its usage limit. Please remove it and try again.');
          err.statusCode = 409;
          err.code = 'INVALID_COUPON';
          throw err;
        }
      }

      // Mark the PaymentIntent used inside the same transaction as order
      // creation, so "payment consumed" and "order exists" always agree --
      // if anything else in this transaction fails, the intent rolls back
      // to unused too, and the customer can legitimately retry.
      if (paymentIntent) {
        paymentIntent.status = 'used';
        paymentIntent.razorpayPaymentId = razorpayPaymentId;
        paymentIntent.usedAt = new Date();
        paymentIntent.expiresAt = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000); // keep as permanent audit record
        await paymentIntent.save({ session });
      }

      const orderId = await generateOrderId(session);

      const [order] = await Order.create(
        [
          {
            orderId,
            idempotencyKey: idempotencyKey || undefined,
            customerName,
            phone,
            alternatePhone,
            address,
            fullAddress,
            products: pricedItems,
            subtotal,
            discount: 0,
            couponCode: appliedCouponCode,
            couponDiscount,
            deliveryCharge,
            totalAmount,
            paymentMethod: paymentMethod || 'COD',
            paymentStatus: paymentMethod === 'Razorpay' ? 'Paid' : 'Pending',
            orderStatus: 'Pending',
            statusHistory: [{ status: 'Pending' }],
          },
        ],
        { session }
      );
      createdOrder = order;
    });

    res.status(201).json({ success: true, message: 'Order placed', data: createdOrder });

    // Send order confirmation notification through FCM.
// Notification failure must never fail the order response.
if (createdOrder?.phone) {
  sendNotificationToPhone(
    createdOrder.phone,
    'THE KAVSI - Order Placed',
    `Your order ${createdOrder.orderId} has been placed successfully.`,
    {
      type: 'order_created',
      orderId: createdOrder.orderId,
      status: createdOrder.orderStatus,
    }
  ).catch((err) =>
    console.error(
      'FCM order confirmation failed:',
      err.message
    )
  );
}
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, message: err.message, code: err.code, unavailable: err.unavailable });
    }
    // A duplicate idempotencyKey slipping past the pre-check (a genuine
    // double-submit race) hits the schema's unique index instead --
    // fetch and return the order that won the race rather than erroring.
    if (err.code === 11000 && err.keyPattern?.idempotencyKey !== undefined) {
      const existing = await Order.findOne({ idempotencyKey, phone }).lean();
      if (existing) {
        return res.status(200).json({ success: true, message: 'Order already placed', data: existing });
      }
    }
    throw err;
  } finally {
    session.endSession();
  }
});

// GET /api/orders/track?orderId=&phone=
// Only returns order details if BOTH orderId and phone match (spec 25).
export const trackOrder = asyncHandler(async (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: 'Order ID and phone number are required' });
  }
  const order = await Order.findOne({ orderId: orderId.trim(), phone: phone.trim() }).lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'No matching order found. Check your Order ID and phone number.' });
  }
  res.json({ success: true, data: order });
});

// POST /api/orders/:orderId/cancel -- customer-initiated cancellation (spec 39)
// Transaction-safe: cancellation and stock restoration either both happen or
// neither does -- never leaves stock restored with the order still active,
// or the order cancelled with stock never given back.
export const cancelOrder = asyncHandler(async (req, res) => {
  const { phone, reason } = req.body;

  const session = await mongoose.startSession();
  try {
    let updatedOrder;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderId: req.params.orderId, phone }).session(session);
      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }
      if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
        const err = new Error(`Orders that are ${order.orderStatus} can no longer be cancelled`);
        err.statusCode = 400;
        throw err;
      }

      const windowMinutes = getCancellationWindowMinutes();
      const ageMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
      if (ageMinutes > windowMinutes) {
        const err = new Error(
          `This order was placed more than ${windowMinutes} minutes ago and can no longer be self-cancelled. Please contact support.`
        );
        err.statusCode = 400;
        throw err;
      }

      for (const item of order.products) {
        await Product.updateOne(
          { _id: item.productId, 'variants.size': item.size, 'variants.color': item.color },
          { $inc: { 'variants.$.stock': item.quantity } },
          { session }
        );
      }

      order.orderStatus = 'Cancelled';
      order.cancellationReason = reason || 'Cancelled by customer';
      order.statusHistory.push({ status: 'Cancelled' });
      await order.save({ session });
      updatedOrder = order;
    });
    res.json({ success: true, message: 'Order cancelled', data: updatedOrder });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err;
  } finally {
    session.endSession();
  }
});

/* --------------------------------- Admin ----------------------------------- */

// GET /api/admin/orders?status=&search=&page=&limit=
export const getAdminOrders = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const query = {};
  if (status) query.orderStatus = status;
  if (search) {
    const safeSearch = escapeRegex(search.trim()).slice(0, 100);
    query.$or = [
      { orderId: new RegExp(safeSearch, 'i') },
      { customerName: new RegExp(safeSearch, 'i') },
      { phone: new RegExp(safeSearch, 'i') },
    ];
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(1, Number(limit)));

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Order.countDocuments(query),
  ]);

  res.json({ success: true, data: orders, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
});

// GET /api/admin/orders/:id
export const getAdminOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
});

// PUT /api/admin/orders/:id/status
// Transaction-safe status updates with a validated transition table -- an
// admin cancelling an order still restores stock atomically with the status
// change, and nonsensical transitions (Delivered -> Pending, Cancelled ->
// Shipped) are rejected outright rather than silently accepted.
// PUT /api/admin/orders/:id/status
// Transaction-safe status updates with FCM customer notifications.
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus } = req.body;

  const session = await mongoose.startSession();

  try {
    let updatedOrder;
    let statusChanged = false;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }

      if (orderStatus && orderStatus !== order.orderStatus) {
        if (!ORDER_STATUS_VALUES.includes(orderStatus)) {
          const err = new Error('Invalid order status');
          err.statusCode = 400;
          throw err;
        }

        const allowed = ALLOWED_TRANSITIONS[order.orderStatus] || [];

        if (!allowed.includes(orderStatus)) {
          const err = new Error(
            `Cannot change status from "${order.orderStatus}" to "${orderStatus}"`
          );

          err.statusCode = 409;
          throw err;
        }

        // If admin cancels the order, restore stock.
        if (orderStatus === 'Cancelled') {
          for (const item of order.products) {
            await Product.updateOne(
              {
                _id: item.productId,
                'variants.size': item.size,
                'variants.color': item.color,
              },
              {
                $inc: {
                  'variants.$.stock': item.quantity,
                },
              },
              {
                session,
              }
            );
          }
        }

        order.orderStatus = orderStatus;

        order.statusHistory.push({
          status: orderStatus,
        });

        statusChanged = true;
      }

      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
      }

      await order.save({
        session,
      });

      updatedOrder = order;
    });

    res.json({
      success: true,
      message: 'Order updated',
      data: updatedOrder,
    });

    // Send FCM notification AFTER the database transaction succeeds.
    // Notification failure must never make the order-status update fail.
    if (statusChanged && updatedOrder?.phone) {
      const notification = getOrderStatusNotification(
        updatedOrder.orderStatus,
        updatedOrder.orderId
      );

      if (notification) {
        sendNotificationToPhone(
          updatedOrder.phone,
          notification.title,
          notification.body,
          {
            type: 'order_status',
            orderId: updatedOrder.orderId,
            status: updatedOrder.orderStatus,
          }
        ).catch((error) => {
          console.error(
            'FCM order status notification failed:',
            error.message
          );
        });
      }
    }
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }

    throw err;
  } finally {
    session.endSession();
  }
});
