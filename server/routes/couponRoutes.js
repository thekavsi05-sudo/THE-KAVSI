import express from 'express';
import { validateCoupon, getAdminCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/couponController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/coupons/validate', validateCoupon);

export const adminCouponRouter = express.Router();
adminCouponRouter.use(protect);
adminCouponRouter.get('/', getAdminCoupons);
adminCouponRouter.post('/', createCoupon);
adminCouponRouter.put('/:id', updateCoupon);
adminCouponRouter.delete('/:id', deleteCoupon);

export default router;
