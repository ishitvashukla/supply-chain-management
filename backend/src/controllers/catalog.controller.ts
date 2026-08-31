import type { Request, RequestHandler, Response } from 'express';
import {
  buildCatalogTree,
  categoryService,
  departmentService,
  priceListService,
  serviceService,
} from '../services/catalog.service';
import type { CrudService } from '../services/crud.factory';
import { optionalStoreScope } from '../middlewares/auth';
import { syncCatalogFromTurns } from '../services/catalogSync.service';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export interface CrudHandlers {
  list: RequestHandler;
  get: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

/** The four catalog levels differ only by label, so their handlers are generated. */
const crudHandlers = <T>(service: CrudService<T>, label: string): CrudHandlers => ({
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, sort, ...rest } = req.query as Record<string, never>;
    const filter: Record<string, unknown> = {};
    // Any remaining query key is treated as an equality filter (department, service, ...).
    Object.entries(rest).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      // Services store a list of price lists, so this is membership.
      filter[key === 'priceList' ? 'priceLists' : key] = value;
    });
    const { items, meta } = await service.list({ page, limit, search, sort, filter });
    return sendSuccess(res, { message: `${label} fetched`, data: items, meta });
  }) as RequestHandler,

  get: asyncHandler(async (req: Request, res: Response) => {
    const doc = await service.getById(req.params.id as string);
    return sendSuccess(res, { message: `${label} fetched`, data: doc });
  }) as RequestHandler,

  create: asyncHandler(async (req: Request, res: Response) => {
    const doc = await service.create(req.body);
    return sendSuccess(res, { statusCode: 201, message: `${label} created`, data: doc });
  }) as RequestHandler,

  update: asyncHandler(async (req: Request, res: Response) => {
    const doc = await service.update(req.params.id as string, req.body);
    return sendSuccess(res, { message: `${label} updated`, data: doc });
  }) as RequestHandler,

  remove: asyncHandler(async (req: Request, res: Response) => {
    await service.remove(req.params.id as string);
    return sendSuccess(res, { message: `${label} deleted` });
  }) as RequestHandler,
});

export const departmentHandlers = crudHandlers(departmentService, 'Department');
export const priceListHandlers = crudHandlers(priceListService, 'Price list');
export const serviceHandlers = crudHandlers(serviceService, 'Service');
export const categoryHandlers = crudHandlers(categoryService, 'Category');

/**
 * The whole nested catalog in one call:
 * PriceList → Service → Category? → Product, with per-store price and stock
 * when a store is in scope.
 */
export const getCatalogTree = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, priceListId } = req.query as { storeId?: string; priceListId?: string };
  const scopedStore = optionalStoreScope(req, storeId);
  const tree = await buildCatalogTree({ storeId: scopedStore, priceListId });
  return sendSuccess(res, {
    message: 'Catalog fetched',
    data: tree,
    meta: { storeId: scopedStore ?? null },
  });
});

/**
 * Mirrors the turns catalog in. The client fetches `price_list` from turns for
 * a store (it holds that session) and hands the tree over; we upsert every
 * level by its turns id.
 */
export const syncCatalog = asyncHandler(async (req: Request, res: Response) => {
  const { priceLists, turnsStoreId } = req.body;
  const counts = await syncCatalogFromTurns(priceLists, turnsStoreId);
  return sendSuccess(res, {
    message:
      `Synced ${counts.services} service(s), ${counts.categories} categor(ies) ` +
      `and ${counts.priceLists} price list(s)`,
    data: counts,
  });
});
