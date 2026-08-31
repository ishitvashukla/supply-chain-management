import { Router } from 'express';
import {
  createOrder,
  getOrder,
  listOrders,
  pendingApproval,
  transitionOrder,
  updateOrder,
} from '../controllers/order.controller';
import { authenticate, validate } from '../middlewares';
import {
  createOrderSchema,
  idParams,
  orderQuery,
  transitionOrderSchema,
  updateOrderSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: orderQuery }), listOrders);
router.get('/pending-approval', pendingApproval);
// Stores order for themselves; admins may pass `store` to order on their behalf.
router.post('/', validate({ body: createOrderSchema }), createOrder);
router.get('/:id', validate({ params: idParams }), getOrder);
router.patch('/:id', validate({ params: idParams, body: updateOrderSchema }), updateOrder);
// Approve / reject / fulfil / cancel all run through the transition guard.
router.post('/:id/status', validate({ params: idParams, body: transitionOrderSchema }), transitionOrder);

export default router;
