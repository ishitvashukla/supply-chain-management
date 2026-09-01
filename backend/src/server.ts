import type { Server } from 'http';
import app from './app';
import env from './config/env';
import { connectDB, disconnectDB } from './config/db';
import logger from './utils/logger';

let server: Server | undefined;

const start = async (): Promise<void> => {
  try {
    await connectDB();
    server = app.listen(env.port, () => {
      logger.info(`Server running in ${env.nodeEnv} mode on http://localhost:${env.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  logger.warn(`${signal} received — shutting down gracefully`);
  server?.close(async () => {
    await disconnectDB();
    logger.info('HTTP server and MongoDB connection closed');
    process.exit(0);
  });

  // Don't hang forever if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
};

/**
 * Log, but keep serving.
 *
 * Tearing the server down over one stray rejection turns a single failed
 * background call into total downtime — and on a host that restarts on exit,
 * into a restart loop. An uncaught *exception* is different: the process may be
 * in an unknown state, so that one still exits.
 */
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection (continuing):', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error.stack ?? error.message);
  process.exit(1);
});

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void start();
