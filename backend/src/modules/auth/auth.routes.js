import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './auth.schema.js';
import * as ctrl from './auth.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } },
});

router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.post('/logout', authenticate, ctrl.logout);

export default router;
