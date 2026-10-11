import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import shopRoutes from './modules/shops/shops.routes.js';
import productRoutes from './modules/products/products.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import salesRoutes from './modules/sales/sales.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import expenseRoutes from './modules/expenses/expenses.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import imageRoutes from './modules/images/images.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import taxCategoryRoutes from './modules/shops/taxCategories.routes.js';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.COOKIE_SECRET));

// Request ID + structured logging
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        id: req.id,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shops', shopRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/tax-categories', taxCategoryRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Central error handler
app.use(errorHandler);

export default app;
