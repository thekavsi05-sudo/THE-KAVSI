import 'dotenv/config';
import Razorpay from 'razorpay';
import crypto from 'crypto';

/*
 * Load Razorpay credentials from server/.env
 *
 * TEST MODE example:
 *
 * RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
 * RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log(
  'Razorpay Key ID loaded:',
  keyId ? 'YES' : 'NO'
);

console.log(
  'Razorpay Key Secret loaded:',
  keySecret ? 'YES' : 'NO'
);

export const razorpayClient =
  keyId && keySecret
    ? new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      })
    : null;


/*
 * Verify Razorpay Checkout payment signature.
 */
export function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return false;
  }

  if (!keySecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(
      `${razorpayOrderId}|${razorpayPaymentId}`
    )
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(
    razorpaySignature
  );

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}