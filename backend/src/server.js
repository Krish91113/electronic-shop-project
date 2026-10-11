import app from './app.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import prisma from './config/db.js';

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(env.PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${env.PORT} in ${env.NODE_ENV} mode`);
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore on exit
    }
    logger.info('Server and database connections closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

