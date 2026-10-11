import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateShopSchema } from './shops.schema.js';
import * as ctrl from './shops.controller.js';

const router = Router();

// GET /api/v1/shops — list all shops for the authenticated user
router.get('/', authenticate, ctrl.getMyShops);

// GET /api/v1/shops/mine — alias kept for backwards compatibility
router.get('/mine', authenticate, ctrl.listUserShops);

// GET /api/v1/shops/current — shop resolved via x-shop-id header
router.get('/current', authenticate, resolveShop, ctrl.getShop);

// PATCH /api/v1/shops/current — update shop resolved via x-shop-id header
router.patch('/current', authenticate, resolveShop, validate(updateShopSchema), ctrl.updateShop);

// GET /api/v1/shops/:id — get shop by URL id param
router.get('/:id', authenticate, ctrl.getOne);

// PATCH /api/v1/shops/:id — update shop by URL id param
router.patch('/:id', authenticate, validate(updateShopSchema), ctrl.update);

export default router;
