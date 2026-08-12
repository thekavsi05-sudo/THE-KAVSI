import mongoose from 'mongoose';

// A snapshot of what was actually purchased — deliberately NOT a live
// reference-only lookup, so editing/deleting the product later never
// changes historical order data (see feature 57 in the spec).
const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String },
    size: { type: String, required: true },
    color: { type: String, required: true },
    price: { type: Number, required: true }, // unit price at time of order, backend-calculated
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    houseNumber: String,
    street: String,
    landmark: String,
    area: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true }, // e.g. KAVSI-2026-000001

    // Set by the frontend once per checkout attempt (see Checkout.jsx) and
    // echoed back on retries/double-clicks so createOrder can recognize
    // "this exact submission already succeeded" instead of creating a
    // second order. Sparse because COD/legacy requests may omit it.
    idempotencyKey: { type: String, index: true, sparse: true },

    customerName: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    alternatePhone: String,

    address: { type: addressSchema, required: true },
    // latitude: { type: Number },
    // longitude: { type: Number },
    fullAddress: { type: String },

    products: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    paymentMethod: { type: String, enum: ['COD', 'Razorpay', 'UPI', 'Card'], default: 'COD' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'Pending', index: true },
    statusHistory: { type: [statusHistorySchema], default: () => [{ status: 'Pending' }] },

    cancellationReason: String,
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
// DB-level guarantee behind the idempotency check in createOrder: even a
// genuine race (two requests with the same key hitting different app
// instances at the same instant) can only ever result in one order.
orderSchema.index({ idempotencyKey: 1, phone: 1 }, { unique: true, sparse: true });

export const ORDER_STATUS_VALUES = ORDER_STATUSES;
export const PAYMENT_STATUS_VALUES = PAYMENT_STATUSES;
export default mongoose.model('Order', orderSchema);
