import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      trim: true,
      required: true,
    },

    color: {
      type: String,
      trim: true,
      required: true,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      min: 0,
    },

    sku: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: '',
    },

    shortDescription: {
      type: String,
      default: '',
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // NEW: Product sub-category
    subCategory: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    brand: {
      type: String,
      default: '',
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    sku: {
      type: String,
      default: '',
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    primaryImage: {
      type: String,
      default: '',
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    sizes: {
      type: [String],
      default: [],
    },

    colors: {
      type: [String],
      default: [],
    },

    tags: {
      type: [String],
      default: [],
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    isNewArrival: {
      type: Boolean,
      default: false,
      index: true,
    },

    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSold: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Category + sub-category filtering
productSchema.index({
  category: 1,
  subCategory: 1,
  isActive: 1,
});

// Useful indexes
productSchema.index({
  isFeatured: 1,
  isActive: 1,
});

productSchema.index({
  isNewArrival: 1,
  isActive: 1,
});

productSchema.index({
  isBestSeller: 1,
  isActive: 1,
});

productSchema.index({
  name: 'text',
  description: 'text',
  category: 'text',
  subCategory: 'text',
  tags: 'text',
});

const Product =
  mongoose.models.Product ||
  mongoose.model('Product', productSchema);

export default Product;