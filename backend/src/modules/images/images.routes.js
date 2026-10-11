// NOTE: This route requires multer. Install it with: npm install multer
import { Router } from 'express';
import { authenticate, resolveShop } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { signedUploadSchema, attachImageSchema, removeImageSchema } from './images.schema.js';
import { upload } from '../../config/multer.js';
import * as ctrl from './images.controller.js';

const router = Router();

router.use(authenticate, resolveShop);

// Preferred flow: server-side upload (multer buffer → Cloudinary). Secrets stay on the server.
router.post('/upload/:productId', upload.single('image'), ctrl.upload);

// OPTIONAL direct-to-Cloudinary flow (signed params + attach)
router.post('/signed-upload', validate(signedUploadSchema), ctrl.signedUpload);
router.post('/attach', validate(attachImageSchema), ctrl.attach);

// Set an image as the product's primary image
router.patch('/:imageId/primary', ctrl.setPrimary);

// PUT to replace an image (server-side upload via multer → Cloudinary)
router.put('/:imageId', upload.single('image'), ctrl.replace);

// DELETE an image by id
router.delete('/:imageId', validate(removeImageSchema), ctrl.remove);

export default router;
