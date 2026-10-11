import prisma from '../config/db.js';
import { ConflictError } from '../utils/errors.js';

/**
 * Idempotency middleware for POST endpoints.
 * Checks Idempotency-Key header, returns cached response if exists.
 */
export function idempotent(endpoint) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    const shopId = req.shopId;
    if (!shopId) return next();

    try {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { shopId_key: { shopId, key } },
      });

      if (existing) {
        if (existing.endpoint !== endpoint) {
          return next(new ConflictError('Idempotency key used with different endpoint'));
        }
        return res.status(existing.responseStatus).json(existing.responseBody);
      }

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = async function (body) {
        try {
          await prisma.idempotencyKey.create({
            data: {
              shopId,
              key,
              endpoint,
              requestHash: '',
              responseStatus: res.statusCode,
              responseBody: body,
            },
          });
        } catch (e) {
          // Ignore duplicate key race condition
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
