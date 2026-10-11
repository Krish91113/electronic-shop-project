import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema, updateExpenseSchema } from './expenses.schema.js';
import * as ctrl from './expenses.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/', validate(createExpenseSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.patch('/:id', validate(updateExpenseSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
