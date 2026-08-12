import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitContactMessage, getAdminMessages, updateMessage, deleteMessage } from '../controllers/contactController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Contact form is public and unauthenticated — a tighter limit than the
// general /api limiter keeps it from being used as a spam/flood vector.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please try again later.' },
});

router.post('/contact', contactLimiter, submitContactMessage);

export const adminContactRouter = express.Router();
adminContactRouter.use(protect);
adminContactRouter.get('/', getAdminMessages);
adminContactRouter.put('/:id', updateMessage);
adminContactRouter.delete('/:id', deleteMessage);

export default router;
