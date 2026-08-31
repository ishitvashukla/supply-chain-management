import { Router } from 'express';
import {
  createStore,
  deleteStore,
  getStore,
  listStores,
  syncStores,
  updateStore,
} from '../controllers/store.controller';
import {
  createStoreItem,
  deleteStoreItem,
  listStoreItems,
  syncStoreCatalog,
  updateStoreItem,
} from '../controllers/storeItem.controller';
import { createMovement, recomputeUsage } from '../controllers/stock.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import {
  createMovementSchema,
  createStoreItemSchema,
  createStoreSchema,
  idParams,
  objectId,
  paginationQuery,
  storeItemQuery,
  syncStoresSchema,
  updateStoreItemSchema,
  updateStoreSchema,
} from '../validators';
import { z } from 'zod';

const router = Router();
const storeParams = z.object({ storeId: objectId });

router.use(authenticate);

router.get('/', validate({ query: paginationQuery }), listStores);
// Stores are owned by turns; this mirrors them in so local records can reference them.
router.post('/sync-from-turns', requireAdmin, validate({ body: syncStoresSchema }), syncStores);
router.post('/', requireAdmin, validate({ body: createStoreSchema }), createStore);
router.get('/:id', validate({ params: idParams }), getStore);
router.patch('/:id', requireAdmin, validate({ params: idParams, body: updateStoreSchema }), updateStore);
router.delete('/:id', requireAdmin, validate({ params: idParams }), deleteStore);

/* --- the per-store item list, nested under its store ------------------- */

router.get('/:storeId/items', validate({ params: storeParams, query: storeItemQuery }), listStoreItems);
router.post('/:storeId/items', validate({ params: storeParams, body: createStoreItemSchema }), createStoreItem);
router.post('/:storeId/items/sync', validate({ params: storeParams }), syncStoreCatalog);
router.post('/:storeId/stock', validate({ params: storeParams, body: createMovementSchema }), createMovement);
router.post('/:storeId/stock/recompute-usage', validate({ params: storeParams }), recomputeUsage);

export default router;

/** Item routes addressed by their own id rather than through a store. */
export const storeItemRouter = Router();
storeItemRouter.use(authenticate);
storeItemRouter.patch('/:id', validate({ params: idParams, body: updateStoreItemSchema }), updateStoreItem);
storeItemRouter.delete('/:id', validate({ params: idParams }), deleteStoreItem);
