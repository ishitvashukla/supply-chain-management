import type { Request, Response } from 'express';
import Store from '../models/store.model';
import { createCrudService } from '../services/crud.factory';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';
import { STORE_ROLES } from '../constants';
import { syncStoresFromTurns } from '../services/storeSync.service';
import ApiError from '../utils/ApiError';

const service = createCrudService(Store, {
  searchFields: ['name', 'code'],
  populate: [
    { path: 'manager', select: 'name email' },
    { path: 'priceList', select: 'name' },
  ],
  defaultSort: 'name',
  label: 'Store',
});

/** Store users see only their own store in the list. */
export const listStores = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, sort } = req.query as Record<string, never>;
  const filter =
    req.user && STORE_ROLES.includes(req.user.role) ? { _id: req.user.storeId } : {};
  const { items, meta } = await service.list({ page, limit, search, sort, filter });
  return sendSuccess(res, { message: 'Stores fetched', data: items, meta });
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (req.user && STORE_ROLES.includes(req.user.role) && req.user.storeId !== id) {
    throw ApiError.forbidden('You can only access your own store');
  }
  const store = await service.getById(id);
  return sendSuccess(res, { message: 'Store fetched', data: store });
});

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  const store = await service.create(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Store created', data: store });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  const store = await service.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Store updated', data: store });
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  return sendSuccess(res, { message: 'Store deleted' });
});

/**
 * Mirrors the caller's turns store list into this app. The client fetches it
 * from turns (it holds that session) and hands it over; we upsert by
 * `turnsStoreId` so local orders and inventory keep a stable store to point at.
 */
export const syncStores = asyncHandler(async (req: Request, res: Response) => {
  const result = await syncStoresFromTurns(req.body.stores);
  return sendSuccess(res, {
    message: `Synced ${result.total} store(s) from turns`,
    data: result,
  });
});
