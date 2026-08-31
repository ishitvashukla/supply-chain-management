import type { Request, Response } from 'express';
import type { PaymentStatus } from '../constants';
import { optionalStoreScope } from '../middlewares/auth';
import paymentService from '../services/payment.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const payment = await paymentService.create(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, message: 'Payment recorded', data: payment });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, storeId, order, status, from, to } = req.query as Record<string, never>;
  const scopedStore = optionalStoreScope(req, storeId);
  const { items, meta } = await paymentService.list({
    page,
    limit,
    order,
    status,
    from,
    to,
    store: scopedStore,
  });
  return sendSuccess(res, { message: 'Payments fetched', data: items, meta });
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.getById(req.params.id as string);
  return sendSuccess(res, { message: 'Payment fetched', data: payment });
});

export const updatePayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const payment = await paymentService.update(req.params.id as string, req.body, req.user.id);
  return sendSuccess(res, { message: 'Payment updated', data: payment });
});

export const updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, notes } = req.body as { status: PaymentStatus; notes?: string };
  const payment = await paymentService.updateStatus(
    req.params.id as string,
    status,
    notes,
    req.user?.id,
  );
  return sendSuccess(res, { message: 'Payment updated', data: payment });
});

export const deletePayment = asyncHandler(async (req: Request, res: Response) => {
  await paymentService.remove(req.params.id as string, req.user?.id);
  return sendSuccess(res, { message: 'Payment deleted' });
});

export const outstandingByStore = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await paymentService.outstandingByStore();
  return sendSuccess(res, { message: 'Outstanding balances', data: rows });
});
