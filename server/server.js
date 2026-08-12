
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import connectDB from './config/db.js';
import './config/firebaseAdmin.js';

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes, { adminProductRouter } from './routes/productRoutes.js';
import orderRoutes, { adminOrderRouter } from './routes/orderRoutes.js';
import categoryRoutes, { adminCategoryRouter } from './routes/categoryRoutes.js';
import couponRoutes, { adminCouponRouter } from './routes/couponRoutes.js';
import { adminReviewRouter } from './routes/reviewRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import contactRoutes, { adminContactRouter } from './routes/contactRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';


await connectDB();

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({
  limit: '2mb',
  // Stashes the raw request bytes for routes that need to verify an HMAC
  // signature computed over the exact payload (Razorpay webhook). Cheap for
  // every other route -- it's just a Buffer reference, never parsed twice.
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(mongoSanitize()); // strips $ and . operators from req.body/query/params — Mongo injection protection
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// General API rate limit (auth login has its own tighter limiter).
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'KAVSI API is running' }));

/* Public + admin route groups. Admin sub-routers are already `protect`-ed
 * internally (see each routes/*.js), so mounting them under /api/admin/*
 * here is just about URL shape, not security — the JWT check happens either
 * way. */
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api/admin/products', adminProductRouter);
app.use('/api', orderRoutes);
app.use('/api/admin/orders', adminOrderRouter);
app.use('/api', categoryRoutes);
app.use('/api/admin/categories', adminCategoryRouter);
app.use('/api', couponRoutes);
app.use('/api/admin/coupons', adminCouponRouter);
app.use('/api/admin/reviews', adminReviewRouter);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api', contactRoutes);
app.use('/api/admin/contact-messages', adminContactRouter);
app.use('/api/admin/upload', uploadRoutes);
app.use('/api', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`KAVSI API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
