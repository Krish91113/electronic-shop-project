import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  scanBarcodeSchema,
  listProductsSchema,
} from './products.schema.js';
import * as ctrl from './products.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/scan', validate(scanBarcodeSchema), ctrl.scan);
router.post('/', validate(createProductSchema), ctrl.create);
router.get('/', validate(listProductsSchema), ctrl.list);
router.get('/:id', ctrl.getOne);
router.patch('/:id', validate(updateProductSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
