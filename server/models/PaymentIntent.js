import mongoose from 'mongoose';

// Created the moment we ask Razorpay to open an order (createRazorpayOrder),
// BEFORE the customer has paid anything. This is the server's own record of
// "what this Razorpay order is supposed to cost and for what cart" — it lets
// createOrder() and the webhook cross-check a payment against the exact
// amount we quoted, and stops the same successful payment from being used
// to create more than one KAVSI order.
const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true }, // paise, matches Razorpay's unit
    currency: { type: String, default: 'INR' },

    phone: { type: String, required: true },
    // Hash of the priced cart (productId+size+color+qty, sorted) at the
    // moment the Razorpay order was created. Lets us detect "customer paid
    // for cart A but is now trying to place order for cart B".
    cartHash: { type: String, required: true },

    status: {
      type: String,
      enum: ['created', 'paid', 'used', 'failed', 'expired'],
      default: 'created',
      index: true,
    },
    razorpayPaymentId: { type: String },

    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

// TTL cleanup: only prunes intents that were created but never completed
// (still 'created'/'failed'/'expired' when expiresAt passes). Order/webhook
// code pushes expiresAt years into the future the moment an intent is
// marked 'paid' or 'used', so completed payment records are never
// auto-deleted — they stay as a permanent audit trail.
paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PaymentIntent', paymentIntentSchema);
