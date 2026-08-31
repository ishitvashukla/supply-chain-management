import type { Request, Response } from 'express';
import { optionalStoreScope } from '../middlewares/auth';
import statsService from '../services/stats.service';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

const scopeOf = (req: Request) =>
  optionalStoreScope(req, (req.query as Record<string, string>).storeId);

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const data = await statsService.overview(scopeOf(req));
  return sendSuccess(res, { message: 'Overview', data });
});

export const orderTrend = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as Record<string, never>;
  const data = await statsService.orderTrend({ storeId: scopeOf(req), days });
  return sendSuccess(res, { message: 'Order trend', data });
});

export const ordersByStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await statsService.ordersByStatus(scopeOf(req));
  return sendSuccess(res, { message: 'Orders by status', data });
});

export const topConsumed = asyncHandler(async (req: Request, res: Response) => {
  const { days, limit } = req.query as Record<string, never>;
  const data = await statsService.topConsumed({ storeId: scopeOf(req), days, limit });
  return sendSuccess(res, { message: 'Top consumed products', data });
});

export const reorderForecast = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = req.query as Record<string, never>;
  const data = await statsService.reorderForecast({ storeId: scopeOf(req), limit });
  return sendSuccess(res, { message: 'Reorder forecast', data });
});

export const financials = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as Record<string, never>;
  const data = await statsService.financials({ storeId: scopeOf(req), days });
  return sendSuccess(res, { message: 'Financial summary', data });
});
