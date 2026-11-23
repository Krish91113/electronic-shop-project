import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  receiveStockUnitsSchema,
  previewStockUnitsSchema,
  listStockUnitsSchema,
  updateStockUnitSchema,
} from './stockUnits.schema.js';
import * as ctrl from './stockUnits.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/receive', validate(receiveStockUnitsSchema), ctrl.receive);
router.post('/receive/preview', validate(previewStockUnitsSchema), ctrl.preview);
router.get('/lookup/:imei', ctrl.lookup);
router.get('/', validate(listStockUnitsSchema), ctrl.list);
router.patch('/:id', validate(updateStockUnitSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;

