import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number }, // cap for percentage coupons
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Validate a coupon against an order subtotal. Returns { valid, discount, message }. */
couponSchema.methods.evaluate = function (subtotal) {
  const now = new Date();
  if (!this.isActive) return { valid: false, message: 'This coupon is no longer active' };
  if (now < this.startDate) return { valid: false, message: 'This coupon is not active yet' };
  if (now > this.expiryDate) return { valid: false, message: 'This coupon has expired' };
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) {
    return { valid: false, message: 'This coupon has reached its usage limit' };
  }
  if (subtotal < this.minOrderAmount) {
    return { valid: false, message: `Minimum order of ₹${this.minOrderAmount} required for this coupon` };
  }
  let discount =
    this.discountType === 'percentage' ? Math.round((subtotal * this.discountValue) / 100) : this.discountValue;
  if (this.maxDiscount) discount = Math.min(discount, this.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { valid: true, discount };
};

export default mongoose.model('Coupon', couponSchema);
