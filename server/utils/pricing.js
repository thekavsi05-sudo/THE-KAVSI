import crypto from 'crypto';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

/**
 * Deterministic fingerprint of a priced cart request.
 */
export function hashCartRequest(products, couponCode) {
  const normalized = (products || [])
    .map(
      (p) =>
        `${p.productId}|${p.size}|${p.color}|${p.quantity}`
    )
    .sort()
    .join(',');

  const raw = `${normalized}::${(
    couponCode || ''
  ).toUpperCase()}`;

  return crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex');
}

function getDeliveryCharge(subtotal) {
  const threshold =
    Number(process.env.FREE_DELIVERY_THRESHOLD) || 999;

  const charge =
    Number(process.env.DEFAULT_DELIVERY_CHARGE) || 79;

  return subtotal >= threshold ? 0 : charge;
}

/**
 * Re-prices a cart against MongoDB and validates stock.
 *
 * Returns:
 * {
 *   pricedItems,
 *   subtotal,
 *   discount,
 *   couponDiscount,
 *   appliedCouponCode,
 *   deliveryCharge,
 *   totalAmount,
 *   unavailable
 * }
 */
export async function priceCart(
  products,
  couponCode,
  session
) {
  const unavailable = [];
  const pricedItems = [];

  let subtotal = 0;
  let discount = 0;

  for (const item of products) {
    const query = Product.findById(item.productId);

    const product = session
      ? await query.session(session)
      : await query;

    if (!product || !product.isActive) {
      unavailable.push({
        ...item,
        reason: 'Product no longer available',
      });

      continue;
    }

    const variant = product.variants.find(
      (v) =>
        v.size === item.size &&
        v.color === item.color
    );

    const stock = variant?.stock ?? 0;

    if (stock < item.quantity) {
      unavailable.push({
        productId: item.productId,
        name: product.name,
        size: item.size,
        color: item.color,
        reason:
          stock === 0
            ? 'Out of stock'
            : `Only ${stock} left`,
        availableStock: stock,
      });

      continue;
    }

    /*
     * Original product price
     */
    const originalUnitPrice = Number(
      product.price
    );

    /*
     * Product discount percentage
     */
    const discountPercentage = Math.min(
      100,
      Math.max(
        0,
        Number(product.discount) || 0
      )
    );

    /*
     * Final price after product discount
     */
    const unitPrice = Math.round(
      originalUnitPrice *
        (1 - discountPercentage / 100)
    );

    /*
     * Discount amount for this item
     */
    const itemDiscount =
      (originalUnitPrice - unitPrice) *
      item.quantity;

    /*
     * Add to totals
     */
    subtotal += unitPrice * item.quantity;

    discount += itemDiscount;

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

  /*
   * Coupon discount
   */
  let couponDiscount = 0;
  let appliedCouponCode;

  if (
    couponCode &&
    unavailable.length === 0
  ) {
    const couponQuery =
      Coupon.findOne({
        code: couponCode.toUpperCase(),
      });

    const coupon = session
      ? await couponQuery.session(session)
      : await couponQuery;

    if (coupon) {
      const evalResult =
        coupon.evaluate(subtotal);

      if (evalResult.valid) {
        couponDiscount =
          evalResult.discount;

        appliedCouponCode =
          coupon.code;
      }
    }
  }

  /*
   * Delivery is calculated after product
   * discount and coupon discount.
   */
  const deliveryCharge =
    getDeliveryCharge(
      subtotal - couponDiscount
    );

  /*
   * Final amount
   */
  const totalAmount = Math.max(
    0,
    subtotal -
      couponDiscount +
      deliveryCharge
  );

  return {
    pricedItems,

    /*
     * Subtotal AFTER product discount
     */
    subtotal,

    /*
     * Total product discount
     */
    discount,

    /*
     * Coupon discount
     */
    couponDiscount,

    appliedCouponCode,

    deliveryCharge,

    totalAmount,

    unavailable,
  };
}

export { getDeliveryCharge };