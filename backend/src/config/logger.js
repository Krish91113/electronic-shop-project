import pino from 'pino';
import { env } from './env.js';

const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  redact: ['req.headers.cookie', 'req.headers.authorization'],
});

export default logger;
