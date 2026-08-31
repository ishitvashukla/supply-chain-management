import type { Response } from 'express';

export interface SuccessPayload<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/** Uniform success envelope so every future API returns the same shape. */
export const sendSuccess = <T>(res: Response, payload: SuccessPayload<T> = {}): Response => {
  const { statusCode = 200, message = 'Success', data = null, meta } = payload;
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
};

export default sendSuccess;
