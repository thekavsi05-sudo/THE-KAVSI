import express from 'express';
import {
  createOrder,
  trackOrder,
  cancelOrder,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  calculateOrderPrice,
} from '../controllers/orderController.js';
import protect from '../middleware/authMiddleware.js';
import { validateOrderInput } from '../middleware/validationMiddleware.js';

const router = express.Router();

/* Public */
/* Public */
router.post('/orders/price', calculateOrderPrice);
router.post('/orders', validateOrderInput, createOrder);
router.get('/orders/track', trackOrder);
router.post('/orders/:orderId/cancel', cancelOrder);

/* Admin */
export const adminOrderRouter = express.Router();
adminOrderRouter.use(protect);
adminOrderRouter.get('/', getAdminOrders);
adminOrderRouter.get('/:id', getAdminOrderById);
adminOrderRouter.put('/:id/status', updateOrderStatus);

export default router;
