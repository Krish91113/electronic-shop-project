import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import * as ctrl from './dashboard.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.get('/', ctrl.getDashboard);

export default router;
