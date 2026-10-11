import { Router } from 'express';
import * as ctrl from './public.controller.js';

const router = Router();

router.get('/shops/:shopSlug/products', ctrl.listProducts);
router.get('/shops/:shopSlug/products/:slugOrId', ctrl.getProduct);

export default router;
