import type { Request, Response } from 'express';
import { resolveStoreScope, optionalStoreScope } from '../middlewares/auth';
import storeItemService from '../services/storeItem.service';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

/**
 * The per-store item list. `storeId` comes from the URL, but store users are
 * always pinned to their own store no matter what they pass.
 */
export const listStoreItems = asyncHandler(async (req: Request, res: Response) => {
  const storeId = resolveStoreScope(req, req.params.storeId as string | undefined);
  const query = req.query as Record<string, never>;
  const { items, meta } = await storeItemService.list(storeId, query);
  return sendSuccess(res, { message: 'Store items fetched', data: items, meta });
});

export const getStoreItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await storeItemService.getById(req.params.id as string);
  resolveStoreScope(req, String(item.store));
  return sendSuccess(res, { message: 'Store item fetched', data: item });
});

export const createStoreItem = asyncHandler(async (req: Request, res: Response) => {
  const storeId = resolveStoreScope(req, req.params.storeId as string | undefined);
  const item = await storeItemService.create(storeId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Item added to store', data: item });
});

export const updateStoreItem = asyncHandler(async (req: Request, res: Response) => {
  const existing = await storeItemService.getById(req.params.id as string);
  resolveStoreScope(req, String(existing.store));
  const item = await storeItemService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Store item updated', data: item });
});

export const deleteStoreItem = asyncHandler(async (req: Request, res: Response) => {
  const existing = await storeItemService.getById(req.params.id as string);
  resolveStoreScope(req, String(existing.store));
  await storeItemService.remove(req.params.id as string);
  return sendSuccess(res, { message: 'Store item removed' });
});

/** Adds every active catalog product this store doesn't stock yet. */
export const syncStoreCatalog = asyncHandler(async (req: Request, res: Response) => {
  const storeId = resolveStoreScope(req, req.params.storeId as string | undefined);
  const result = await storeItemService.syncCatalog(storeId);
  return sendSuccess(res, { message: `Added ${result.added} item(s)`, data: result });
});

export const lowStock = asyncHandler(async (req: Request, res: Response) => {
  const storeId = optionalStoreScope(req, req.query.storeId as string | undefined);
  const items = await storeItemService.lowStock(storeId);
  return sendSuccess(res, { message: 'Low stock items', data: items });
});
