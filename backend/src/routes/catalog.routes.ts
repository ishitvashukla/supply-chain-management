import { Router } from 'express';
import {
  categoryHandlers,
  departmentHandlers,
  getCatalogTree,
  priceListHandlers,
  serviceHandlers,
  syncCatalog,
  type CrudHandlers,
} from '../controllers/catalog.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import {
  catalogTreeQuery,
  createCategorySchema,
  createDepartmentSchema,
  createPriceListSchema,
  createServiceSchema,
  idParams,
  paginationQuery,
  updateCategorySchema,
  updateDepartmentSchema,
  updatePriceListSchema,
  updateServiceSchema,
  syncCatalogSchema,
} from '../validators';
import type { ZodType } from 'zod';

/**
 * Every catalog level is read by anyone signed in and written by admins only.
 * `extraQuery` lets a level accept its parent as a filter (?department=…).
 */
const crudRouter = (
  handlers: CrudHandlers,
  schemas: { create: ZodType; update: ZodType },
  listQuery: ZodType = paginationQuery,
): Router => {
  const router = Router();
  router.get('/', validate({ query: listQuery }), handlers.list);
  router.get('/:id', validate({ params: idParams }), handlers.get);
  router.post('/', requireAdmin, validate({ body: schemas.create }), handlers.create);
  router.patch(
    '/:id',
    requireAdmin,
    validate({ params: idParams, body: schemas.update }),
    handlers.update,
  );
  router.delete('/:id', requireAdmin, validate({ params: idParams }), handlers.remove);
  return router;
};

const router = Router();
router.use(authenticate);

// The whole nested tree in one call — the endpoint the storefront actually uses.
router.get('/tree', validate({ query: catalogTreeQuery }), getCatalogTree);
// The catalog is owned by turns; this mirrors it in.
router.post('/sync-from-turns', requireAdmin, validate({ body: syncCatalogSchema }), syncCatalog);

router.use(
  '/departments',
  crudRouter(departmentHandlers, {
    create: createDepartmentSchema,
    update: updateDepartmentSchema,
  }),
);

router.use(
  '/price-lists',
  crudRouter(
    priceListHandlers,
    { create: createPriceListSchema, update: updatePriceListSchema },
    paginationQuery.extend({ department: idParams.shape.id.optional() }),
  ),
);

router.use(
  '/services',
  crudRouter(
    serviceHandlers,
    { create: createServiceSchema, update: updateServiceSchema },
    paginationQuery.extend({
      department: idParams.shape.id.optional(),
      priceList: idParams.shape.id.optional(),
    }),
  ),
);

router.use(
  '/categories',
  crudRouter(
    categoryHandlers,
    { create: createCategorySchema, update: updateCategorySchema },
    paginationQuery.extend({ service: idParams.shape.id.optional() }),
  ),
);

export default router;
