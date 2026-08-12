import Razorpay from 'razorpay';
import crypto from 'crypto';

// Both env vars come from Dashboard → Settings → API Keys (test keys are
// free and instant; live keys need a completed KYC on the Razorpay account).
// Left undefined in dev until you add them to server/.env — razorpayClient
// stays null rather than throwing at import time, so the rest of the app
// still boots; only the payment routes will 500 until keys are set.
export const razorpayClient =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

/**
 * Razorpay Checkout returns razorpay_order_id + razorpay_payment_id +
 * razorpay_signature to the frontend on a successful payment. The signature
 * is an HMAC-SHA256 of `${orderId}|${paymentId}` signed with your key
 * secret — recomputing it server-side and comparing is the only way to know
 * the payment is real and wasn't just faked by someone calling your API
 * directly with paymentMethod: 'Razorpay'.
 */
export function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return false;
  if (!process.env.RAZORPAY_KEY_SECRET) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  // Constant-time comparison — a plain === would leak timing information
  // an attacker could use to guess the signature byte-by-byte.
  const a = Buffer.from(expected);
  const b = Buffer.from(razorpaySignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
