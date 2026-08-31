import type { Request, Response } from 'express';
import type { StockMovement } from '../constants';
import { optionalStoreScope, resolveStoreScope } from '../middlewares/auth';
import stockService from '../services/stock.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

/** Records a stock movement and updates the store item's running quantity. */
export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const storeId = resolveStoreScope(req, req.params.storeId as string | undefined);
  const result = await stockService.record(
    { ...req.body, store: storeId, type: req.body.type as StockMovement },
    req.user.id,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Stock movement recorded',
    data: result,
  });
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, storeId, product, type, from, to } = req.query as Record<string, never>;
  const scopedStore = optionalStoreScope(req, storeId);
  const { items, meta } = await stockService.list({
    page,
    limit,
    product,
    type,
    from,
    to,
    store: scopedStore,
  });
  return sendSuccess(res, { message: 'Stock movements fetched', data: items, meta });
});

/** Recomputes average daily usage so the reorder forecast stays honest. */
export const recomputeUsage = asyncHandler(async (req: Request, res: Response) => {
  const storeId = resolveStoreScope(req, req.params.storeId as string | undefined);
  const days = Number(req.query.days ?? 30);
  const result = await stockService.recomputeUsage(storeId, days);
  return sendSuccess(res, { message: 'Usage recalculated', data: result });
});
