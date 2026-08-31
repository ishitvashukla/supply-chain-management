import { Router } from 'express';
import { listMovements } from '../controllers/stock.controller';
import { lowStock } from '../controllers/storeItem.controller';
import { authenticate, validate } from '../middlewares';
import { movementQuery } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/movements', validate({ query: movementQuery }), listMovements);
router.get('/low-stock', lowStock);

export default router;
