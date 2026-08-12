import express from 'express';
import {
  getProducts,
  getProductById,
  getVariantStock,
  getAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  exportProductsCsv,
} from '../controllers/productController.js';
import { getProductReviews, createReview } from '../controllers/reviewController.js';
import protect from '../middleware/authMiddleware.js';
import { validateProductInput } from '../middleware/validationMiddleware.js';

const router = express.Router();

/* Public */
router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.get('/products/:id/variant-stock', getVariantStock);
router.get('/products/:productId/reviews', getProductReviews);
router.post('/products/:productId/reviews', createReview);

/* Admin (mounted separately below at /api/admin/products, kept here for one export) */
export const adminProductRouter = express.Router();
adminProductRouter.use(protect);
adminProductRouter.get('/', getAdminProducts);
adminProductRouter.get('/export', exportProductsCsv);
adminProductRouter.post('/', validateProductInput, createProduct);
adminProductRouter.patch('/bulk', bulkUpdateProducts);
// NOTE: '/export' and '/bulk' must stay registered above this catch-all
// '/:id' route or Express will try to treat "export"/"bulk" as an :id.
adminProductRouter.get('/:id', getAdminProductById);
adminProductRouter.put('/:id', validateProductInput, updateProduct);
adminProductRouter.delete('/:id', deleteProduct);

export default router;
