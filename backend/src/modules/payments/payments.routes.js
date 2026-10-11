import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPaymentSchema } from './payments.schema.js';
import * as ctrl from './payments.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/', validate(createPaymentSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

export default router;
