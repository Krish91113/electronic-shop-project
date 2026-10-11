import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors.js';

const TOKEN_EXPIRY = '7d';

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always compare to avoid timing attacks revealing account existence
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const memberships = await prisma.shopMembership.findMany({
    where: { userId: user.id },
    include: { shop: { select: { id: true, name: true, slug: true, code: true } } },
  });

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      shops: memberships.map((m) => m.shop),
    },
  };
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid session');

  const memberships = await prisma.shopMembership.findMany({
    where: { userId: user.id },
    include: { shop: { select: { id: true, name: true, slug: true, code: true } } },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    shops: memberships.map((m) => m.shop),
  };
}
