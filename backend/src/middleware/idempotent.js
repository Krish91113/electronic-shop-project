import crypto from 'crypto';
import prisma from '../config/db.js';
import { ConflictError } from '../utils/errors.js';

/**
 * Compute a stable hash of the request body so a reused idempotency key
 * with a different payload is rejected instead of replaying a stale response.
 */
function hashRequest(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

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

    const requestHash = hashRequest(req.body);

    try {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { shopId_key: { shopId, key } },
      });

      if (existing) {
        if (existing.endpoint !== endpoint || existing.requestHash !== requestHash) {
          return next(new ConflictError('Idempotency key already used with a different request'));
        }
        return res.status(existing.responseStatus).json(existing.responseBody);
      }

      // Intercept res.json to capture the response for future replays
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        // Only persist successful (2xx) responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          prisma.idempotencyKey
            .create({
              data: {
                shopId,
                key,
                endpoint,
                requestHash,
                responseStatus: res.statusCode,
                responseBody: body,
              },
            })
            .catch(() => {
              // Ignore duplicate-key race conditions
            });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
