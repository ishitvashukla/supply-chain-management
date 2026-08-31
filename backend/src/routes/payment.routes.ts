import { Router } from 'express';
import {
  createPayment,
  deletePayment,
  getPayment,
  listPayments,
  outstandingByStore,
  updatePayment,
  updatePaymentStatus,
} from '../controllers/payment.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import {
  createPaymentSchema,
  idParams,
  paymentQuery,
  updatePaymentSchema,
  updatePaymentStatusSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: paymentQuery }), listPayments);
router.get('/outstanding', requireAdmin, outstandingByStore);
router.post('/', requireAdmin, validate({ body: createPaymentSchema }), createPayment);
router.get('/:id', validate({ params: idParams }), getPayment);
// Full edit of a recorded payment (amount, method, date…).
router.patch(
  '/:id',
  requireAdmin,
  validate({ params: idParams, body: updatePaymentSchema }),
  updatePayment,
);
// Narrow helper for just flipping status.
router.patch(
  '/:id/status',
  requireAdmin,
  validate({ params: idParams, body: updatePaymentStatusSchema }),
  updatePaymentStatus,
);
router.delete('/:id', requireAdmin, validate({ params: idParams }), deletePayment);

export default router;
