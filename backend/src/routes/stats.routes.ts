import { Router } from 'express';
import {
  financials,
  orderTrend,
  ordersByStatus,
  overview,
  reorderForecast,
  topConsumed,
} from '../controllers/stats.controller';
import { authenticate, validate } from '../middlewares';
import { statsQuery } from '../validators';

const router = Router();

// All read-only aggregations; each is scoped to the caller's store automatically.
router.use(authenticate, validate({ query: statsQuery }));

router.get('/overview', overview);
router.get('/order-trend', orderTrend);
router.get('/orders-by-status', ordersByStatus);
router.get('/top-consumed', topConsumed);
router.get('/reorder-forecast', reorderForecast);
router.get('/financials', financials);

export default router;
