import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateShopSchema } from './shops.schema.js';
import * as ctrl from './shops.controller.js';

const router = Router();

router.get('/mine', authenticate, ctrl.listUserShops);
router.get('/current', authenticate, resolveShop, ctrl.getShop);
router.patch('/current', authenticate, resolveShop, validate(updateShopSchema), ctrl.updateShop);

export default router;
