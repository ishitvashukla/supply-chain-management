import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError';
import env from '../config/env';
import logger from '../utils/logger';

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

const isDuplicateKeyError = (err: unknown): err is MongoDuplicateKeyError =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

/** Translate known library errors into our own ApiError shape. */
const normalize = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;

  // Schema validation failed on save/update.
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.badRequest('Validation failed', details);
  }

  // A malformed ObjectId (or other cast failure) in params/body.
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for field '${err.path}': ${String(err.value)}`);
  }

  if (isDuplicateKeyError(err)) {
    const fields = Object.keys(err.keyValue ?? {});
    return ApiError.conflict(
      `Duplicate value for ${fields.length ? fields.join(', ') : 'unique field'}`,
      err.keyValue,
    );
  }

  // Body-parser rejected the JSON payload.
  if (err instanceof SyntaxError && 'body' in err) {
    return ApiError.badRequest('Malformed JSON in request body');
  }

  // Unknown/unexpected: never leak the raw message to the client.
  const message = err instanceof Error ? err.message : String(err);
  const internal = ApiError.internal(env.isProd ? 'Internal server error' : message);
  if (err instanceof Error) internal.stack = err.stack;
  return internal;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs all 4 args
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const error = normalize(err);

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, error.stack ?? error.message);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(env.isProd ? {} : { stack: error.stack }),
  });
};

export default errorHandler;
