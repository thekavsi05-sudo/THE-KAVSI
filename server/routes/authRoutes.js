import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminLogin, getMe, changePassword } from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import { validateLogin } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Slow down brute-force attempts against the login endpoint specifically.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

router.post('/admin/login', loginLimiter, validateLogin, adminLogin);
router.get('/admin/me', protect, getMe);
router.put('/admin/change-password', protect, changePassword);

export default router;
