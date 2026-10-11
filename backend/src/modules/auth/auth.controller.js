import * as authService from './auth.service.js';
import { env } from '../../config/env.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.cookie('token', result.token, COOKIE_OPTS);
    res.json({ data: { ...result.user, token: result.token } });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ data: { message: 'Logged out' } });
}
