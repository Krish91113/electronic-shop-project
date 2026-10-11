import logger from '../config/logger.js';
import { AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details) body.error.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `Duplicate value on: ${err.meta?.target?.join(', ') || 'unknown field'}`,
      },
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }

  // Multer (file upload) errors
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image exceeds the 5MB size limit'
        : `Upload error: ${err.message}`;
    return res.status(400).json({
      error: { code: 'UPLOAD_ERROR', message },
    });
  }

  // Zod validation
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }

  logger.error({ err, reqId: req.id }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
