import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    orderId: { type: String, required: true }, // used to verify the reviewer actually ordered this product
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    isApproved: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Bug 10: a customer can only leave one review per (order, product) pair.
// The DB-level unique index is the real guarantee (closes the race where two
// requests for the same order+product land at the same instant); the
// application-level check in createReview exists only to return a friendly
// error instead of a raw duplicate-key 500.
reviewSchema.index({ orderId: 1, product: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
