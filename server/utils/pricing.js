import crypto from 'crypto';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

/**
 * Deterministic fingerprint of a priced cart request (productId/size/color/
 * quantity + coupon), independent of item order. Used to bind a
 * PaymentIntent to the exact cart it was created for, so a payment made for
 * one cart can't later be replayed to pay for a different (possibly
 * cheaper) one.
 */
export function hashCartRequest(products, couponCode) {
  const normalized = (products || [])
    .map((p) => `${p.productId}|${p.size}|${p.color}|${p.quantity}`)
    .sort()
    .join(',');
  const raw = `${normalized}::${(couponCode || '').toUpperCase()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getDeliveryCharge(subtotal) {
  const threshold = Number(process.env.FREE_DELIVERY_THRESHOLD) || 999;
  const charge = Number(process.env.DEFAULT_DELIVERY_CHARGE) || 79;
  return subtotal >= threshold ? 0 : charge;
}

/**
 * Re-prices a cart against MongoDB and validates stock — the same
 * "never trust the frontend" pricing logic used by createOrder, factored
 * out so the Razorpay "create an order for this amount" endpoint computes
 * the exact same total instead of duplicating (and risking drifting from)
 * the pricing rules.
 *
 * Read-only: does NOT decrement stock or touch a session. createOrder still
 * owns the atomic decrement inside its own transaction.
 *
 * Returns { pricedItems, subtotal, couponDiscount, appliedCouponCode,
 *           deliveryCharge, totalAmount, unavailable }
 */
export async function priceCart(products, couponCode, session) {
  const unavailable = [];
  const pricedItems = [];
  let subtotal = 0;

  for (const item of products) {
    const query = Product.findById(item.productId);
    const product = session ? await query.session(session) : await query;
    if (!product || !product.isActive) {
      unavailable.push({ ...item, reason: 'Product no longer available' });
      continue;
    }
    const variant = product.variants.find((v) => v.size === item.size && v.color === item.color);
    const stock = variant?.stock ?? 0;
    if (stock < item.quantity) {
      unavailable.push({
        productId: item.productId,
        name: product.name,
        size: item.size,
        color: item.color,
        reason: stock === 0 ? 'Out of stock' : `Only ${stock} left`,
        availableStock: stock,
      });
      continue;
    }

    const unitPrice = Math.round(product.price * (1 - (product.discount || 0) / 100));
    subtotal += unitPrice * item.quantity;
    pricedItems.push({
      productId: product._id,
      name: product.name,
      image: product.images?.[0],
      size: item.size,
      color: item.color,
      price: unitPrice,
      quantity: item.quantity,
    });
  }

  let couponDiscount = 0;
  let appliedCouponCode;
  if (couponCode && unavailable.length === 0) {
    const couponQuery = Coupon.findOne({ code: couponCode.toUpperCase() });
    const coupon = session ? await couponQuery.session(session) : await couponQuery;
    if (coupon) {
      const evalResult = coupon.evaluate(subtotal);
      if (evalResult.valid) {
        couponDiscount = evalResult.discount;
        appliedCouponCode = coupon.code;
      }
    }
  }

  const deliveryCharge = getDeliveryCharge(subtotal - couponDiscount);
  const totalAmount = Math.max(0, subtotal - couponDiscount + deliveryCharge);

  return { pricedItems, subtotal, couponDiscount, appliedCouponCode, deliveryCharge, totalAmount, unavailable };
}

export { getDeliveryCharge };
