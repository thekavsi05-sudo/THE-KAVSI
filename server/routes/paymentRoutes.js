import express from 'express';
import rateLimit from 'express-rate-limit';
import { createRazorpayOrder, razorpayWebhook } from '../controllers/paymentController.js';

const router = express.Router();

// Payment-intent creation is a normal authenticated-by-context customer
// action, but still worth throttling harder than general browsing traffic.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please wait a few minutes and try again.' },
});

router.post('/payments/razorpay/order', paymentLimiter, createRazorpayOrder);

// Razorpay webhook -- called server-to-server by Razorpay, not by the
// browser. No rate limiting here (Razorpay's own infra controls delivery
// rate) and no CORS/auth requirement -- security comes entirely from HMAC
// signature verification inside the handler.
router.post('/payments/webhook', razorpayWebhook);

export default router;
