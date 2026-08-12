import crypto from 'crypto';
import { priceCart, hashCartRequest } from '../utils/pricing.js';
import { razorpayClient } from '../utils/razorpayClient.js';
import PaymentIntent from '../models/PaymentIntent.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const INTENT_TTL_MINUTES = 30;

// POST /api/payments/razorpay/order
// Called right before the Razorpay Checkout widget opens. Re-prices the cart
// the same way createOrder does (never trusts a client-supplied amount),
// asks Razorpay to open an order for that exact total, and records a
// PaymentIntent -- our own server-side record of "this Razorpay order is
// worth Rs X for this exact cart" that createOrder() and the webhook both
// check against later. The actual KAVSI Order document is only created
// afterwards in createOrder, once the payment signature AND this intent
// have both been verified -- this endpoint never touches stock.
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  if (!razorpayClient) {
    return res.status(503).json({
      success: false,
      message: 'Online payments are not configured yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to server/.env.',
    });
  }

  const { products, couponCode, phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'A valid 10-digit phone number is required' });
  }

  const { totalAmount, unavailable } = await priceCart(products, couponCode);

  if (unavailable.length > 0) {
    return res.status(409).json({ success: false, message: 'Some items are no longer available', unavailable });
  }
  if (totalAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Order total must be greater than zero' });
  }

  const amountPaise = Math.round(totalAmount * 100);

  // Razorpay wants the amount in paise (smallest currency unit), as an integer.
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
    expiresAt: new Date(Date.now() + INTENT_TTL_MINUTES * 60 * 1000),
  });

  res.json({
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

/**
 * Verifies a Razorpay payment against the PaymentIntent we created for it.
 * Called from orderController.createOrder AFTER the HMAC signature has
 * already been verified. Returns { ok: true, intent } or { ok: false, message }.
 * Does NOT mark the intent as used -- the caller does that inside its own
 * transaction, only once the order is actually about to be created.
 */
export async function checkPaymentIntent({ razorpayOrderId, phone, products, couponCode, totalAmountPaise }) {
  const intent = await PaymentIntent.findOne({ razorpayOrderId });
  if (!intent) return { ok: false, message: 'Payment record not found. Please contact support before retrying.' };
  if (intent.status === 'used') return { ok: false, message: 'This payment has already been used to place an order.' };
  if (intent.status === 'expired' || intent.expiresAt < new Date()) {
    return { ok: false, message: 'This payment session has expired. Please try again.' };
  }
  if (intent.phone !== phone) {
    return { ok: false, message: 'Payment does not match this checkout session.' };
  }
  if (intent.cartHash !== hashCartRequest(products, couponCode)) {
    return { ok: false, message: 'Your cart changed after payment was started. Please review your cart and try again.' };
  }
  if (intent.amount !== totalAmountPaise) {
    return { ok: false, message: 'Payment amount does not match the order total.' };
  }
  return { ok: true, intent };
}

/**
 * POST /api/payments/webhook
 *
 * Razorpay's server-to-server notification of payment events. This is a
 * reconciliation safety net, independent of the customer's browser: even if
 * the customer closes the tab right after paying (so the normal
 * createOrder() call from the frontend never happens), the webhook still
 * lets us know the payment succeeded.
 *
 * Signature verification uses the RAW request body (Razorpay signs the
 * exact bytes it sent) -- server.js's express.json() is configured with a
 * `verify` callback that stashes req.rawBody for this purpose.
 *
 * Idempotent: replays of the same event (Razorpay retries webhooks that
 * don't get a 2xx response) just re-confirm the same PaymentIntent state
 * instead of double-processing anything.
 *
 * NOTE: this currently reconciles PaymentIntent status only. If a payment
 * succeeds here but the customer never completes checkout (so no Order is
 * ever created from this intent), that shows up as a PaymentIntent stuck at
 * status:"paid" with no matching Order -- a support/admin job to surface and
 * resolve those is a reasonable next step, not yet built.
 */
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set -- rejecting webhook.');
    return res.status(503).json({ success: false, message: 'Webhook not configured' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;
  if (!signature || !rawBody) {
    return res.status(400).json({ success: false, message: 'Missing signature or body' });
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  const validSignature = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!validSignature) {
    console.warn('Razorpay webhook: invalid signature');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const event = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;
  const razorpayOrderId = paymentEntity?.order_id;
  const razorpayPaymentId = paymentEntity?.id;

  if (!razorpayOrderId) {
    // Event type we don't act on (e.g. non-payment events) -- acknowledge
    // and move on so Razorpay doesn't keep retrying it.
    return res.json({ success: true, message: 'Ignored' });
  }

  const intent = await PaymentIntent.findOne({ razorpayOrderId });
  if (!intent) {
    // Nothing we recognize -- acknowledge so Razorpay stops retrying.
    return res.json({ success: true, message: 'No matching payment intent' });
  }

  // Idempotency: if we've already resolved this intent (used, or already
  // marked paid/failed by an earlier delivery of this same webhook), don't
  // reprocess it.
  if (intent.status === 'used') {
    return res.json({ success: true, message: 'Already used' });
  }

  if (event === 'payment.captured' || event === 'order.paid') {
    if (intent.status !== 'paid') {
      intent.status = 'paid';
      intent.razorpayPaymentId = razorpayPaymentId;
      intent.expiresAt = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000); // stop TTL cleanup, keep as audit record
      await intent.save();
    }
  } else if (event === 'payment.failed') {
    if (intent.status === 'created') {
      intent.status = 'failed';
      await intent.save();
    }
  }
  // Other events (refund.*, etc.) are accepted but not yet acted on beyond
  // logging -- refund state machine is a documented next step.

  res.json({ success: true });
});
