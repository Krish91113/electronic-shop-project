import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import * as ctrl from './reports.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.get('/profit-loss', ctrl.profitLoss);

export default router;
