import express from 'express';
import { getAdminReviews, moderateReview, deleteReview } from '../controllers/reviewController.js';
import protect from '../middleware/authMiddleware.js';

export const adminReviewRouter = express.Router();
adminReviewRouter.use(protect);
adminReviewRouter.get('/', getAdminReviews);
adminReviewRouter.put('/:id', moderateReview);
adminReviewRouter.delete('/:id', deleteReview);

export default express.Router(); // no public-only review routes beyond what's nested under /products
