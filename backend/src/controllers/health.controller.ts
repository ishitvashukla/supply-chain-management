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

export const health = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, {
    message: 'Server is healthy',
    data: {
      status: 'ok',
      env: env.nodeEnv,
      timestamp: toIso(),
      uptime: dayjs.duration(process.uptime(), 'seconds').humanize(),
      database: {
        name: mongoose.connection.name,
        status: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      },
    },
  }),
);
