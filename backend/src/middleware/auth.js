import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../config/db.js';
import { UnauthorizedError, NotFoundError } from '../utils/errors.js';

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) throw new UnauthorizedError('Authentication required');

    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid session');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
    next(err);
  }
}

/**
 * Middleware to resolve shop from x-shop-id header and verify membership.
 * Returns 404 on cross-shop access to avoid leaking shop ids.
 */
export async function resolveShop(req, _res, next) {
  try {
    const shopId = req.headers['x-shop-id'];
    if (!shopId) throw new NotFoundError('Shop context required');

    const membership = await prisma.shopMembership.findUnique({
      where: { userId_shopId: { userId: req.user.id, shopId } },
      include: { shop: true },
    });
    if (!membership) throw new NotFoundError('Shop not found');

    req.shop = membership.shop;
    req.shopId = membership.shop.id;
    next();
  } catch (err) {
    next(err);
  }
}
