import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotent.js';
import {
  receiveStockSchema,
  adjustStockSchema,
  listMovementsSchema,
} from './inventory.schema.js';
import * as ctrl from './inventory.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/receive', idempotent('inventory.receive'), validate(receiveStockSchema), ctrl.receive);
router.post('/adjust', validate(adjustStockSchema), ctrl.adjust);
router.get('/', ctrl.list);
router.get('/low-stock', ctrl.lowStock);
router.get('/movements', validate(listMovementsSchema), ctrl.movements);

export default router;
