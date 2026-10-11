import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { signedUploadSchema, attachImageSchema, removeImageSchema } from './images.schema.js';
import * as ctrl from './images.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

router.post('/signed-upload', validate(signedUploadSchema), ctrl.signedUpload);
router.post('/attach', validate(attachImageSchema), ctrl.attach);
router.put('/:imageId', ctrl.replace);
router.delete('/:imageId', validate(removeImageSchema), ctrl.remove);

export default router;
