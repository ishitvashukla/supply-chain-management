import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { toIso, dayjs } from '../utils/date';
import env from '../config/env';

const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Which build is live.
 *
 * Render exposes the deployed commit as RENDER_GIT_COMMIT; other hosts vary, so
 * GIT_COMMIT is honoured too. Without this there is no way to tell from outside
 * whether a push actually reached the running service.
 */
const buildInfo = {
  commit: (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'unknown').slice(0, 7),
  branch: process.env.RENDER_GIT_BRANCH ?? process.env.GIT_BRANCH ?? 'unknown',
  startedAt: new Date().toISOString(),
};

export const health = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, {
    message: 'Server is healthy',
    data: {
      status: 'ok',
      env: env.nodeEnv,
      build: buildInfo,
      timestamp: toIso(),
      uptime: dayjs.duration(process.uptime(), 'seconds').humanize(),
      database: {
        name: mongoose.connection.name,
        status: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      },
    },
  }),
);
