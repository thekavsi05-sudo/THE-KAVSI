import mongoose from 'mongoose';

// A snapshot of what was actually purchased.
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
    },

    size: {
      type: String,
      required: true,
    },

    color: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
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
    status: {
      type: String,
      required: true,
    },

    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES = [
  'Pending',
  'Paid',
  'Failed',
  'Refunded',
];

const REFUND_STATUSES = [
  'Not Required',
  'Pending',
  'Processed',
  'Failed',
];

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Idempotency protection
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
      index: true,
    },

    alternatePhone: String,

    address: {
      type: addressSchema,
      required: true,
    },

    fullAddress: {
      type: String,
    },

    products: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => v.length > 0,
    },

    subtotal: {
      type: Number,
      required: true,
    },

    discount: {
      type: Number,
      default: 0,
    },

    couponCode: {
      type: String,
    },

    couponDiscount: {
      type: Number,
      default: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ['COD', 'Razorpay', 'UPI', 'Card'],
      default: 'COD',
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'Pending',
    },

    /*
     * Razorpay payment information
     *
     * These are required so that we can refund a successful
     * Razorpay payment later if the admin cancels the order.
     */
    razorpayOrderId: {
      type: String,
      default: '',
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: '',
      index: true,
    },

    /*
     * Refund information
     */
    refundStatus: {
      type: String,
      enum: REFUND_STATUSES,
      default: 'Not Required',
    },

    razorpayRefundId: {
      type: String,
      default: '',
      index: true,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundFailureReason: {
      type: String,
      default: '',
    },

    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'Pending',
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: () => [{ status: 'Pending' }],
    },

    cancellationReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({
  createdAt: -1,
});

// Idempotency protection
orderSchema.index(
  {
    idempotencyKey: 1,
    phone: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

// Useful Razorpay lookup index
orderSchema.index({
  razorpayPaymentId: 1,
  paymentStatus: 1,
});

export const ORDER_STATUS_VALUES = ORDER_STATUSES;
export const PAYMENT_STATUS_VALUES = PAYMENT_STATUSES;
export const REFUND_STATUS_VALUES = REFUND_STATUSES;

const Order =
  mongoose.models.Order ||
  mongoose.model('Order', orderSchema);

export default Order;