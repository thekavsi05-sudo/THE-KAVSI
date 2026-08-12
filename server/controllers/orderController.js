import mongoose from 'mongoose';
import Order, { ORDER_STATUS_VALUES } from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import generateOrderId from '../utils/generateOrderId.js';
import { priceCart } from '../utils/pricing.js';
import { verifyRazorpaySignature } from '../utils/razorpayClient.js';
import {
  checkPaymentIntent,
  refundRazorpayPayment,
} from './paymentController.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import escapeRegex from '../utils/escapeRegex.js';
import { sendNotificationToPhone } from './notificationController.js';

const CANCELLABLE_STATUSES = ['Pending', 'Confirmed', 'Packed'];

function getCancellationWindowMinutes() {
  const raw = Number(process.env.ORDER_CANCELLATION_WINDOW_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

const ALLOWED_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Out for Delivery', 'Delivered'],
  'Out for Delivery': ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

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

/* =========================================================
   CALCULATE ORDER PRICE
   ========================================================= */

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

/* =========================================================
   CREATE ORDER
   ========================================================= */

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

    // Razorpay values returned by Checkout
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body;

  /*
   * Idempotency protection
   */
  if (idempotencyKey) {
    const existing = await Order.findOne({
      idempotencyKey,
      phone,
    }).lean();

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Order already placed',
        data: existing,
      });
    }
  }

  /*
   * Razorpay payment verification
   */
  let paymentIntent;

  if (paymentMethod === 'Razorpay') {
    const ok = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!ok) {
      return res.status(400).json({
        success: false,
        message:
          'Payment verification failed. Please try again.',
      });
    }

    const {
      totalAmount: previewTotal,
      unavailable: previewUnavailable,
    } = await priceCart(products, couponCode);

    if (previewUnavailable.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Some items are no longer available',
        unavailable: previewUnavailable,
      });
    }

    const intentCheck = await checkPaymentIntent({
      razorpayOrderId,
      phone,
      products,
      couponCode,
      totalAmountPaise: Math.round(
        previewTotal * 100
      ),
    });

    if (!intentCheck.ok) {
      return res.status(409).json({
        success: false,
        message: intentCheck.message,
      });
    }

    paymentIntent = intentCheck.intent;
  }

  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const {
        pricedItems,
        subtotal,
        couponDiscount,
        appliedCouponCode,
        deliveryCharge,
        totalAmount,
        unavailable,
      } = await priceCart(
        products,
        couponCode,
        session
      );

      if (unavailable.length > 0) {
        const err = new Error(
          'Some items are no longer available in the requested quantity'
        );

        err.statusCode = 409;
        err.unavailable = unavailable;

        throw err;
      }

      /*
       * Decrease stock atomically
       */
      for (const item of pricedItems) {
        const result = await Product.updateOne(
          {
            _id: item.productId,
            variants: {
              $elemMatch: {
                size: item.size,
                color: item.color,
                stock: {
                  $gte: item.quantity,
                },
              },
            },
          },
          {
            $inc: {
              'variants.$.stock': -item.quantity,
            },
          },
          {
            session,
          }
        );

        if (result.modifiedCount === 0) {
          const err = new Error(
            `${item.name} (${item.color}/${item.size}) sold out during checkout`
          );

          err.statusCode = 409;

          err.unavailable = [
            {
              ...item,
              reason: 'Sold out during checkout',
              availableStock: 0,
            },
          ];

          throw err;
        }
      }

      /*
       * Coupon usage
       */
      if (appliedCouponCode) {
        const couponUpdate = await Coupon.updateOne(
          {
            code: appliedCouponCode,
            $or: [
              {
                usageLimit: {
                  $lte: 0,
                },
              },
              {
                $expr: {
                  $lt: [
                    '$usedCount',
                    '$usageLimit',
                  ],
                },
              },
            ],
          },
          {
            $inc: {
              usedCount: 1,
            },
          },
          {
            session,
          }
        );

        if (couponUpdate.modifiedCount === 0) {
          const err = new Error(
            'This coupon has just reached its usage limit. Please remove it and try again.'
          );

          err.statusCode = 409;
          err.code = 'INVALID_COUPON';

          throw err;
        }
      }

      /*
       * Mark Razorpay PaymentIntent as used
       */
      if (paymentIntent) {
        paymentIntent.status = 'used';
        paymentIntent.razorpayPaymentId =
          razorpayPaymentId;
        paymentIntent.usedAt = new Date();

        paymentIntent.expiresAt = new Date(
          Date.now() +
            5 *
              365 *
              24 *
              60 *
              60 *
              1000
        );

        await paymentIntent.save({
          session,
        });
      }

      const orderId = await generateOrderId(
        session
      );

      /*
       * CREATE ORDER
       *
       * IMPORTANT:
       * Save Razorpay IDs so we can refund this
       * exact payment later.
       */
      const [order] = await Order.create(
        [
          {
            orderId,

            idempotencyKey:
              idempotencyKey || undefined,

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

            paymentMethod:
              paymentMethod || 'COD',

            paymentStatus:
              paymentMethod === 'Razorpay'
                ? 'Paid'
                : 'Pending',

            /*
             * Razorpay information
             */
            razorpayOrderId:
              paymentMethod === 'Razorpay'
                ? razorpayOrderId
                : '',

            razorpayPaymentId:
              paymentMethod === 'Razorpay'
                ? razorpayPaymentId
                : '',

            /*
             * Refund is not required initially.
             */
            refundStatus:
              paymentMethod === 'Razorpay'
                ? 'Not Required'
                : 'Not Required',

            refundAmount: 0,

            orderStatus: 'Pending',

            statusHistory: [
              {
                status: 'Pending',
              },
            ],
          },
        ],
        {
          session,
        }
      );

      createdOrder = order;
    });

    res.status(201).json({
      success: true,
      message: 'Order placed',
      data: createdOrder,
    });

    /*
     * Order confirmation notification
     */
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
      return res.status(409).json({
        success: false,
        message: err.message,
        code: err.code,
        unavailable: err.unavailable,
      });
    }

    /*
     * Duplicate idempotency key
     */
    if (
      err.code === 11000 &&
      err.keyPattern?.idempotencyKey !== undefined
    ) {
      const existing = await Order.findOne({
        idempotencyKey,
        phone,
      }).lean();

      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Order already placed',
          data: existing,
        });
      }
    }

    throw err;
  } finally {
    session.endSession();
  }
});

/* =========================================================
   TRACK ORDER
   ========================================================= */

export const trackOrder = asyncHandler(async (req, res) => {
  const {
    orderId,
    phone,
  } = req.query;

  if (!orderId || !phone) {
    return res.status(400).json({
      success: false,
      message:
        'Order ID and phone number are required',
    });
  }

  const order = await Order.findOne({
    orderId: orderId.trim(),
    phone: phone.trim(),
  }).lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      message:
        'No matching order found. Check your Order ID and phone number.',
    });
  }

  res.json({
    success: true,
    data: order,
  });
});

/* =========================================================
   CUSTOMER CANCEL ORDER
   ========================================================= */

export const cancelOrder = asyncHandler(async (req, res) => {
  const { phone, reason } = req.body;

  /*
   * First inspect the order before starting a transaction.
   * Razorpay API calls should NOT happen inside a MongoDB transaction.
   */
  const existingOrder = await Order.findOne({
    orderId: req.params.orderId,
    phone,
  });

  if (!existingOrder) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  /*
   * Customer can only cancel these statuses.
   */
  if (!CANCELLABLE_STATUSES.includes(existingOrder.orderStatus)) {
    return res.status(400).json({
      success: false,
      message: `Orders that ${existingOrder.orderStatus} can no longer be cancelled`,
    });
  }

  /*
   * Customer cancellation time limit.
   */
  const windowMinutes = getCancellationWindowMinutes();

  const ageMinutes =
    (Date.now() - existingOrder.createdAt.getTime()) / 60000;

  if (ageMinutes > windowMinutes) {
    return res.status(400).json({
      success: false,
      message: `This order was placed more than ${windowMinutes} minutes ago and can no longer be self-cancelled. Please contact support.`,
    });
  }

  /*
   * =====================================================
   * RAZORPAY REFUND FOR CUSTOMER CANCELLATION
   * =====================================================
   *
   * Refund only when:
   * 1. Customer is cancelling
   * 2. Payment method is Razorpay
   * 3. Payment was successful
   * 4. Razorpay payment ID exists
   * 5. Refund has not already been created
   */

  let refundResult = null;

  const isRazorpayPaidOrder =
    existingOrder.paymentMethod === 'Razorpay' &&
    existingOrder.paymentStatus === 'Paid';

  const refundAlreadyCreated =
    Boolean(existingOrder.razorpayRefundId) ||
    existingOrder.refundStatus === 'Pending' ||
    existingOrder.refundStatus === 'Processed';

  if (isRazorpayPaidOrder && !refundAlreadyCreated) {
    if (!existingOrder.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message:
          'This Razorpay order does not have a payment ID, so the refund cannot be created automatically. Please contact support.',
      });
    }

    try {
      refundResult = await refundRazorpayPayment({
        razorpayPaymentId: existingOrder.razorpayPaymentId,

        amountRupees: existingOrder.totalAmount,

        notes: {
          orderId: existingOrder.orderId,
          customerPhone: existingOrder.phone,
          reason: 'Order cancelled by customer',
        },
      });
    } catch (refundError) {
      console.error(
        'Razorpay customer cancellation refund failed:',
        refundError
      );

      return res.status(502).json({
        success: false,
        message:
          'Order cancellation was stopped because the Razorpay refund could not be created. Please try again.',
        error:
          process.env.NODE_ENV !== 'production'
            ? refundError.message
            : undefined,
      });
    }
  }

  const session = await mongoose.startSession();

  try {
    let updatedOrder;

    await session.withTransaction(async () => {
      /*
       * Re-read the order inside the transaction.
       * This protects against two cancellation requests arriving together.
       */
      const order = await Order.findOne({
        orderId: req.params.orderId,
        phone,
      }).session(session);

      if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
      }

      /*
       * Make sure another request did not cancel it already.
       */
      if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
        const err = new Error(
          `Orders that ${order.orderStatus} can no longer be cancelled`
        );

        err.statusCode = 400;
        throw err;
      }

      /*
       * Restore stock.
       */
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

      /*
       * Cancel the order.
       */
      order.orderStatus = 'Cancelled';

      order.cancellationReason =
        reason || 'Cancelled by customer';

      order.statusHistory.push({
        status: 'Cancelled',
      });

      /*
       * Save Razorpay refund information.
       */
      if (refundResult) {
        const refundStatus =
          refundResult.status === 'processed'
            ? 'Processed'
            : 'Pending';

        order.refundStatus = refundStatus;

        order.razorpayRefundId = refundResult.id;

        order.refundAmount =
          Number(refundResult.amount || 0) / 100;

        if (refundStatus === 'Processed') {
          order.refundedAt = new Date();

          order.paymentStatus = 'Refunded';
        }
      }

      await order.save({
        session,
      });

      updatedOrder = order;
    });

    res.json({
      success: true,

      message: refundResult
        ? 'Order cancelled and Razorpay refund initiated successfully'
        : 'Order cancelled',

      data: updatedOrder,
    });

    /*
     * Send cancellation notification.
     */
    if (updatedOrder?.phone) {
      sendNotificationToPhone(
        updatedOrder.phone,
        'THE KAVSI - Order Cancelled',
        refundResult
          ? `Your order ${updatedOrder.orderId} has been cancelled and your Razorpay refund has been initiated.`
          : `Your order ${updatedOrder.orderId} has been cancelled.`,
        {
          type: 'order_status',
          orderId: updatedOrder.orderId,
          status: updatedOrder.orderStatus,
        }
      ).catch((error) => {
        console.error(
          'FCM cancellation notification failed:',
          error.message
        );
      });
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

/* =========================================================
   ADMIN
   ========================================================= */

/* GET /api/admin/orders */
export const getAdminOrders = asyncHandler(async (req, res) => {
  const {
    status,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (status) {
    query.orderStatus = status;
  }

  if (search) {
    const safeSearch = escapeRegex(
      search.trim()
    ).slice(0, 100);

    query.$or = [
      {
        orderId: new RegExp(
          safeSearch,
          'i'
        ),
      },
      {
        customerName: new RegExp(
          safeSearch,
          'i'
        ),
      },
      {
        phone: new RegExp(
          safeSearch,
          'i'
        ),
      },
    ];
  }

  const pageNum = Math.max(
    1,
    Number(page)
  );

  const limitNum = Math.min(
    200,
    Math.max(1, Number(limit))
  );

  const [
    orders,
    total,
  ] = await Promise.all([
    Order.find(query)
      .sort({
        createdAt: -1,
      })
      .skip(
        (pageNum - 1) *
          limitNum
      )
      .limit(limitNum)
      .lean(),

    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(
        total / limitNum
      ),
    },
  });
});

/* GET /api/admin/orders/:id */
export const getAdminOrderById = asyncHandler(
  async (req, res) => {
    const order =
      await Order.findById(
        req.params.id
      ).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  }
);

/* =========================================================
   ADMIN UPDATE ORDER STATUS
   ========================================================= */

export const updateOrderStatus = asyncHandler(
  async (req, res) => {
    const {
      orderStatus,
      paymentStatus,
    } = req.body;

    /*
     * We intentionally create the Razorpay refund
     * BEFORE the MongoDB transaction when cancelling.
     *
     * Reason:
     * Razorpay API calls should not be performed while
     * a MongoDB transaction is open.
     */

    let refundResult = null;

    /*
     * First inspect the order.
     */
    const existingOrder =
      await Order.findById(
        req.params.id
      );

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    /*
     * Validate requested transition before
     * creating a refund.
     */
    if (
      orderStatus &&
      orderStatus !==
        existingOrder.orderStatus
    ) {
      if (
        !ORDER_STATUS_VALUES.includes(
          orderStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid order status',
        });
      }

      const allowed =
        ALLOWED_TRANSITIONS[
          existingOrder.orderStatus
        ] || [];

      if (!allowed.includes(orderStatus)) {
        return res.status(409).json({
          success: false,
          message:
            `Cannot change status from "${existingOrder.orderStatus}" to "${orderStatus}"`,
        });
      }
    }

    /*
     * =====================================================
     * RAZORPAY REFUND
     * =====================================================
     *
     * Only refund when:
     *
     * 1. Admin is cancelling
     * 2. Payment method is Razorpay
     * 3. Payment was successful
     * 4. A Razorpay payment ID exists
     * 5. Refund hasn't already been created
     */

    const isAdminCancellation =
      orderStatus === 'Cancelled' &&
      existingOrder.orderStatus !==
        'Cancelled';

    const isRazorpayPaidOrder =
      existingOrder.paymentMethod ===
        'Razorpay' &&
      existingOrder.paymentStatus ===
        'Paid';

    const refundAlreadyCreated =
      Boolean(
        existingOrder.razorpayRefundId
      ) ||
      existingOrder.refundStatus ===
        'Pending' ||
      existingOrder.refundStatus ===
        'Processed';

    if (
      isAdminCancellation &&
      isRazorpayPaidOrder &&
      !refundAlreadyCreated
    ) {
      if (
        !existingOrder.razorpayPaymentId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'This Razorpay order does not have a payment ID, so the refund cannot be created automatically. Please contact support.',
        });
      }

      try {
        refundResult =
          await refundRazorpayPayment({
            razorpayPaymentId:
              existingOrder.razorpayPaymentId,

            amountRupees:
              existingOrder.totalAmount,

            notes: {
              orderId:
                existingOrder.orderId,

              customerPhone:
                existingOrder.phone,

              reason:
                'Order cancelled by admin',
            },
          });
      } catch (refundError) {
        console.error(
          'Razorpay refund failed:',
          refundError
        );

        return res.status(502).json({
          success: false,
          message:
            'Order cancellation was stopped because the Razorpay refund could not be created. Please try again.',
          error:
            process.env.NODE_ENV !==
            'production'
              ? refundError.message
              : undefined,
        });
      }
    }

    const session =
      await mongoose.startSession();

    try {
      let updatedOrder;
      let statusChanged = false;

      await session.withTransaction(
        async () => {
          const order =
            await Order.findById(
              req.params.id
            ).session(session);

          if (!order) {
            const err = new Error(
              'Order not found'
            );

            err.statusCode = 404;

            throw err;
          }

          /*
           * Re-check transition inside the
           * transaction.
           */
          if (
            orderStatus &&
            orderStatus !==
              order.orderStatus
          ) {
            if (
              !ORDER_STATUS_VALUES.includes(
                orderStatus
              )
            ) {
              const err = new Error(
                'Invalid order status'
              );

              err.statusCode = 400;

              throw err;
            }

            const allowed =
              ALLOWED_TRANSITIONS[
                order.orderStatus
              ] || [];

            if (
              !allowed.includes(
                orderStatus
              )
            ) {
              const err = new Error(
                `Cannot change status from "${order.orderStatus}" to "${orderStatus}"`
              );

              err.statusCode = 409;

              throw err;
            }

            /*
             * Restore stock when admin cancels.
             */
            if (
              orderStatus ===
              'Cancelled'
            ) {
              for (const item of order.products) {
                await Product.updateOne(
                  {
                    _id:
                      item.productId,

                    'variants.size':
                      item.size,

                    'variants.color':
                      item.color,
                  },
                  {
                    $inc: {
                      'variants.$.stock':
                        item.quantity,
                    },
                  },
                  {
                    session,
                  }
                );
              }
            }

            order.orderStatus =
              orderStatus;

            order.statusHistory.push({
              status:
                orderStatus,
            });

            statusChanged = true;
          }

          /*
           * Save refund information.
           */
          if (
            refundResult
          ) {
            const refundStatus =
              refundResult.status ===
              'processed'
                ? 'Processed'
                : 'Pending';

            order.refundStatus =
              refundStatus;

            order.razorpayRefundId =
              refundResult.id;

            order.refundAmount =
              Number(
                refundResult.amount || 0
              ) / 100;

            if (
              refundStatus ===
              'Processed'
            ) {
              order.refundedAt =
                new Date();
            }

            /*
             * Mark payment as refunded.
             *
             * Even if Razorpay initially reports
             * pending, the payment has entered the
             * refund process.
             */
            if (
              refundStatus ===
              'Processed'
            ) {
              order.paymentStatus =
                'Refunded';
            }
          }

          /*
           * Allow explicit payment status updates
           * only when a refund wasn't already handled.
           */
          if (
            paymentStatus &&
            !refundResult
          ) {
            order.paymentStatus =
              paymentStatus;
          }

          await order.save({
            session,
          });

          updatedOrder = order;
        }
      );

      res.json({
        success: true,

        message: refundResult
          ? 'Order cancelled and Razorpay refund initiated successfully'
          : 'Order updated',

        data: updatedOrder,
      });

      /*
       * FCM notification AFTER successful
       * database transaction.
       */
      if (
        statusChanged &&
        updatedOrder?.phone
      ) {
        const notification =
          getOrderStatusNotification(
            updatedOrder.orderStatus,
            updatedOrder.orderId
          );

        if (notification) {
          sendNotificationToPhone(
            updatedOrder.phone,
            notification.title,
            notification.body,
            {
              type:
                'order_status',

              orderId:
                updatedOrder.orderId,

              status:
                updatedOrder.orderStatus,
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
        return res.status(
          err.statusCode
        ).json({
          success: false,
          message: err.message,
        });
      }

      throw err;
    } finally {
      session.endSession();
    }
  }
);