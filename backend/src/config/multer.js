import multer from 'multer';
import { BadRequestError } from '../utils/errors.js';

const storage = multer.memoryStorage();

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
  },
});
