import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotent.js';
import { createSaleSchema, listSalesSchema, returnSaleSchema } from './sales.schema.js';
import * as ctrl from './sales.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/', idempotent('sales.create'), validate(createSaleSchema), ctrl.create);
router.get('/', validate(listSalesSchema), ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/invoice', ctrl.invoice);
router.post('/:id/cancel', ctrl.cancel);
router.post('/:id/return', validate(returnSaleSchema), ctrl.returnItems);

export default router;
