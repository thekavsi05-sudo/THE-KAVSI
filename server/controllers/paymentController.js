import crypto from 'crypto';
import { priceCart, hashCartRequest } from '../utils/pricing.js';
import { razorpayClient } from '../utils/razorpayClient.js';
import PaymentIntent from '../models/PaymentIntent.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const INTENT_TTL_MINUTES = 30;

/* =========================================================
   CREATE RAZORPAY ORDER
========================================================= */

// POST /api/payments/razorpay/order
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  if (!razorpayClient) {
    return res.status(503).json({
      success: false,
      message:
        'Online payments are not configured yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to server/.env.',
    });
  }

  const { products, couponCode, phone } = req.body;

  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'A valid 10-digit phone number is required',
    });
  }

  const { totalAmount, unavailable } = await priceCart(
    products,
    couponCode
  );

  if (unavailable.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Some items are no longer available',
      unavailable,
    });
  }

  if (totalAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Order total must be greater than zero',
    });
  }

  const amountPaise = Math.round(totalAmount * 100);

  const razorpayOrder = await razorpayClient.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `THE-kavsi_${Date.now()}`,
  });

  await PaymentIntent.create({
    razorpayOrderId: razorpayOrder.id,
    amount: amountPaise,
    currency: 'INR',
    phone,
    cartHash: hashCartRequest(products, couponCode),
    status: 'created',
    expiresAt: new Date(
      Date.now() + INTENT_TTL_MINUTES * 60 * 1000
    ),
  });

  return res.json({
    success: true,
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      totalAmount,
    },
  });
});

/* =========================================================
   CHECK PAYMENT INTENT
========================================================= */

export async function checkPaymentIntent({
  razorpayOrderId,
  phone,
  products,
  couponCode,
  totalAmountPaise,
}) {
  const intent = await PaymentIntent.findOne({
    razorpayOrderId,
  });

  if (!intent) {
    return {
      ok: false,
      message:
        'Payment record not found. Please contact support before retrying.',
    };
  }

  if (intent.status === 'used') {
    return {
      ok: false,
      message:
        'This payment has already been used to place an order.',
    };
  }

  if (
    intent.status === 'expired' ||
    intent.expiresAt < new Date()
  ) {
    return {
      ok: false,
      message:
        'This payment session has expired. Please try again.',
    };
  }

  if (intent.phone !== phone) {
    return {
      ok: false,
      message:
        'Payment does not match this checkout session.',
    };
  }

  if (
    intent.cartHash !==
    hashCartRequest(products, couponCode)
  ) {
    return {
      ok: false,
      message:
        'Your cart changed after payment was started. Please review your cart and try again.',
    };
  }

  if (intent.amount !== totalAmountPaise) {
    return {
      ok: false,
      message:
        'Payment amount does not match the order total.',
    };
  }

  return {
    ok: true,
    intent,
  };
}

/* =========================================================
   REFUND RAZORPAY PAYMENT
========================================================= */

/**
 * Creates a Razorpay refund for a captured payment.
 *
 * amountRupees:
 * - If supplied, creates a partial refund.
 * - If omitted, creates a full refund.
 *
 * Returns:
 * {
 *   id,
 *   amount,
 *   status
 * }
 */
export async function refundRazorpayPayment({
  razorpayPaymentId,
  amountRupees,
  notes = {},
}) {
  if (!razorpayClient) {
    throw new Error(
      'Razorpay is not configured on the server.'
    );
  }

  if (!razorpayPaymentId) {
    throw new Error(
      'Razorpay payment ID is missing. Cannot create refund.'
    );
  }

  const options = {};

  /*
   * Razorpay amount is always in paise.
   *
   * If amountRupees is not provided, Razorpay will create
   * a full refund for the captured payment.
   */
  if (
    amountRupees !== undefined &&
    amountRupees !== null
  ) {
    const amountPaise = Math.round(
      Number(amountRupees) * 100
    );

    if (
      !Number.isFinite(amountPaise) ||
      amountPaise <= 0
    ) {
      throw new Error(
        'Refund amount must be greater than zero.'
      );
    }

    options.amount = amountPaise;
  }

  options.notes = {
    source: 'THE_KAVSI',
    ...Object.fromEntries(
      Object.entries(notes).map(([key, value]) => [
        key,
        String(value),
      ])
    ),
  };

  const refund = await razorpayClient.payments.refund(
    razorpayPaymentId,
    options
  );

  console.log(
    'Razorpay refund created:',
    refund.id,
    'payment:',
    razorpayPaymentId,
    'amount:',
    refund.amount,
    'status:',
    refund.status
  );

  return refund;
}

/* =========================================================
   RAZORPAY WEBHOOK
========================================================= */

// POST /api/payments/webhook
export const razorpayWebhook = asyncHandler(
  async (req, res) => {
    const secret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    /* =====================================================
       CHECK WEBHOOK SECRET
    ===================================================== */

    if (!secret) {
      console.error(
        'RAZORPAY_WEBHOOK_SECRET is not set -- rejecting webhook.'
      );

      return res.status(503).json({
        success: false,
        message: 'Webhook not configured',
      });
    }

    /* =====================================================
       GET SIGNATURE + RAW BODY
    ===================================================== */

    const signature =
      req.headers['x-razorpay-signature'];

    const rawBody = req.rawBody;

    if (!signature || !rawBody) {
      return res.status(400).json({
        success: false,
        message: 'Missing signature or body',
      });
    }

    /* =====================================================
       VERIFY SIGNATURE
    ===================================================== */

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));

    const validSignature =
      a.length === b.length &&
      crypto.timingSafeEqual(a, b);

    if (!validSignature) {
      console.warn(
        'Razorpay webhook: invalid signature'
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    /* =====================================================
       GET EVENT
    ===================================================== */

    const event = req.body?.event;

    console.log(
      'Razorpay webhook received:',
      event
    );

    /* =====================================================
       PAYMENT EVENTS
    ===================================================== */

    const paymentEntity =
      req.body?.payload?.payment?.entity;

    const razorpayOrderId =
      paymentEntity?.order_id;

    const razorpayPaymentId =
      paymentEntity?.id;

    if (razorpayOrderId) {
      const intent =
        await PaymentIntent.findOne({
          razorpayOrderId,
        });

      if (!intent) {
        console.log(
          'No matching payment intent:',
          razorpayOrderId
        );

        return res.json({
          success: true,
          message: 'No matching payment intent',
        });
      }

      if (intent.status === 'used') {
        return res.json({
          success: true,
          message: 'Already used',
        });
      }

      /* =================================================
         PAYMENT CAPTURED / ORDER PAID
      ================================================= */

      if (
        event === 'payment.captured' ||
        event === 'order.paid'
      ) {
        if (intent.status !== 'paid') {
          intent.status = 'paid';

          intent.razorpayPaymentId =
            razorpayPaymentId;

          /*
           * Keep the payment intent alive long enough
           * for the order creation flow to complete.
           */
          intent.expiresAt = new Date(
            Date.now() +
            5 *
            365 *
            24 *
            60 *
            60 *
            1000
          );

          await intent.save();

          console.log(
            'Payment intent marked as paid:',
            razorpayOrderId
          );
        }
      }

      /* =================================================
         PAYMENT FAILED
      ================================================= */

      else if (event === 'payment.failed') {
        if (intent.status === 'created') {
          intent.status = 'failed';

          await intent.save();

          console.log(
            'Payment intent marked as failed:',
            razorpayOrderId
          );
        }
      }
    }

    /* =====================================================
       REFUND EVENTS
    ===================================================== */

    const refundEntity =
      req.body?.payload?.refund?.entity;

    if (refundEntity) {
      const refundId = refundEntity.id;

      const refundPaymentId =
        refundEntity.payment_id;

      const refundAmountPaise =
        Number(refundEntity.amount);

      const refundAmountRupees =
        Number.isFinite(refundAmountPaise)
          ? refundAmountPaise / 100
          : undefined;

      console.log(
        'Razorpay refund webhook:',
        event,
        'refund:',
        refundId,
        'payment:',
        refundPaymentId,
        'amount:',
        refundAmountRupees
      );

      /* =================================================
         FIND ORDER
      ================================================= */

      const order = await Order.findOne({
        razorpayPaymentId: refundPaymentId,
      });

      if (!order) {
        console.warn(
          'Refund webhook: Order not found for payment:',
          refundPaymentId
        );

        /*
         * We still return 200 because Razorpay successfully
         * delivered the webhook. This prevents unnecessary
         * webhook retries.
         */
        return res.json({
          success: true,
          message: 'Refund received but order not found',
        });
      }

      /* =================================================
         REFUND CREATED
      ================================================= */

      if (event === 'refund.created') {
        order.razorpayRefundId = refundId;

        if (refundAmountRupees !== undefined) {
          order.refundAmount =
            refundAmountRupees;
        }

        /*
         * Keep status Pending until Razorpay confirms
         * that the refund was actually processed.
         */
        order.refundStatus = 'Pending';

        await order.save();

        console.log(
          'Order refund status updated to Pending:',
          order.orderId
        );
      }

      /* =================================================
         REFUND PROCESSED
      ================================================= */

      else if (event === 'refund.processed') {
        order.razorpayRefundId = refundId;

        if (refundAmountRupees !== undefined) {
          order.refundAmount =
            refundAmountRupees;
        }

        order.refundStatus = 'Processed';

        order.refundedAt = new Date();

        order.refundFailureReason = '';

        await order.save();

        console.log(
          'Order refund marked as PROCESSED:',
          order.orderId,
          'refund:',
          refundId,
          'amount:',
          refundAmountRupees
        );
      }

      /* =================================================
         REFUND FAILED
      ================================================= */

      else if (event === 'refund.failed') {
        order.razorpayRefundId = refundId;

        if (refundAmountRupees !== undefined) {
          order.refundAmount =
            refundAmountRupees;
        }

        order.refundStatus = 'Failed';

        order.refundedAt = null;

        order.refundFailureReason =
          refundEntity?.error_description ||
          refundEntity?.error_reason ||
          refundEntity?.error_code ||
          'Razorpay refund failed';

        await order.save();

        console.error(
          'Order refund marked as FAILED:',
          order.orderId,
          'refund:',
          refundId,
          'reason:',
          order.refundFailureReason
        );
      }
    }

    /* =====================================================
       ACKNOWLEDGE WEBHOOK
    ===================================================== */

    return res.json({
      success: true,
    });
  }
);