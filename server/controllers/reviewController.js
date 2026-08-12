import Review from '../models/Review.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import recalculateProductRating from '../utils/ratingService.js';

// GET /api/products/:productId/reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId, isApproved: true, isHidden: false }).sort({ createdAt: -1 });
  res.json({ success: true, data: reviews });
});

// POST /api/products/:productId/reviews — { orderId, phone, customerName, rating, comment }
// Verifies the reviewer actually has a delivered order containing this product,
// to prevent fake review manipulation (spec 38).
export const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { orderId, phone, customerName, rating, comment } = req.body;

  if (!orderId || !phone || !rating) {
    return res.status(400).json({ success: false, message: 'Order ID, phone, and rating are required' });
  }

  const order = await Order.findOne({ orderId, phone });
  if (!order) {
    return res.status(403).json({ success: false, message: 'We could not verify this order. Only customers who purchased this product can review it.' });
  }
  // Bug 9: only a Delivered order proves the customer actually received the
  // product -- Pending/Confirmed/Shipped/Cancelled orders don't qualify,
  // regardless of what the frontend might otherwise allow.
  if (order.orderStatus !== 'Delivered') {
    return res.status(403).json({
      success: false,
      code: 'ORDER_NOT_DELIVERED',
      message: 'You can review a product only after your order has been delivered.',
    });
  }
  const purchased = order.products.some((p) => String(p.productId) === String(productId));
  if (!purchased) {
    return res.status(403).json({ success: false, message: 'This product was not part of that order.' });
  }

  // Bug 10: application-level duplicate check for a friendly error message;
  // the unique (orderId, product) index on the schema is the actual
  // guarantee against a genuine race between two near-simultaneous requests.
  const existing = await Review.findOne({ orderId, product: productId });
  if (existing) {
    return res.status(409).json({
      success: false,
      code: 'REVIEW_ALREADY_EXISTS',
      message: 'You have already reviewed this product for this order.',
    });
  }

  let review;
  try {
    review = await Review.create({
      product: productId,
      orderId,
      phone,
      customerName: customerName || order.customerName,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment: comment || '',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        code: 'REVIEW_ALREADY_EXISTS',
        message: 'You have already reviewed this product for this order.',
      });
    }
    throw err;
  }

  await recalculateProductRating(review.product);

  res.status(201).json({ success: true, data: review });
});

/* --------------------------------- Admin ----------------------------------- */

export const getAdminReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({}).populate('product', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data: reviews });
});

export const moderateReview = asyncHandler(async (req, res) => {
  const { isApproved, isHidden } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  if (isApproved !== undefined) review.isApproved = !!isApproved;
  if (isHidden !== undefined) review.isHidden = !!isHidden;
  await review.save();
  // Bug 11: approving/hiding a review changes which reviews are publicly
  // visible, so the product's rating/reviewCount must be recomputed here too
  // -- not just at creation time.
  await recalculateProductRating(review.product);
  res.json({ success: true, data: review });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  await recalculateProductRating(review.product);
  res.json({ success: true, message: 'Review deleted' });
});
