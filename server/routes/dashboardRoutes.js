import express from 'express';
import { getDashboardStats, getBestSellers, getSalesChart } from '../controllers/dashboardController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', getDashboardStats);
router.get('/best-sellers', getBestSellers);
router.get('/sales', getSalesChart);

export default router;
