import Review from '../models/Review.js';
import Product from '../models/Product.js';

/**
 * Bug 11: single source of truth for a product's public rating/reviewCount.
 * Only reviews that are actually visible (approved AND not hidden) count
 * toward the average — call this after ANY review create/approve/hide/
 * delete/restore so the two numbers never drift out of sync with what a
 * customer would see if they counted the visible reviews themselves.
 */
export default async function recalculateProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId, isApproved: true, isHidden: false } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
  const reviewCount = stats[0]?.count || 0;

  await Product.findByIdAndUpdate(productId, { rating, reviewCount });
  return { rating, reviewCount };
}
