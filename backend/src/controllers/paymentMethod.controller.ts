import type { Request, Response } from 'express';
import paymentMethodService from '../services/paymentMethod.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const listPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, isActive } = req.query as Record<string, never>;
  const filter: Record<string, unknown> = {};
  if (typeof isActive === 'boolean') filter.isActive = isActive;

  const { items, meta } = await paymentMethodService.list({ page, limit, search, filter });
  return sendSuccess(res, { message: 'Payment methods fetched', data: items, meta });
});

export const getPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const method = await paymentMethodService.getById(req.params.id as string);
  return sendSuccess(res, { message: 'Payment method fetched', data: method });
});

export const createPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const method = await paymentMethodService.create({ ...req.body, createdBy: req.user.id });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Payment method created',
    data: method,
  });
});

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const method = await paymentMethodService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Payment method updated', data: method });
});

export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  await paymentMethodService.remove(req.params.id as string);
  return sendSuccess(res, { message: 'Payment method deleted' });
});
