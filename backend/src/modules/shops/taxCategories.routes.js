import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './taxCategories.controller.js';
import { createTaxCategorySchema, updateTaxCategorySchema } from './taxCategories.schema.js';

const router = Router({ mergeParams: true });
router.use(authenticate, resolveShop);

router.get('/', ctrl.list);
router.post('/', validate(createTaxCategorySchema), ctrl.create);
router.patch('/:tcId', validate(updateTaxCategorySchema), ctrl.update);
router.delete('/:tcId', ctrl.remove);

export default router;
