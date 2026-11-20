import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import * as ctrl from './reports.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.get('/profit-loss', ctrl.profitLoss);
router.get('/stock-valuation', ctrl.stockValuation);
router.get('/sales-by-model', ctrl.salesByModel);
router.get('/imei-history/:imei', ctrl.imeiHistory);

export default router;
