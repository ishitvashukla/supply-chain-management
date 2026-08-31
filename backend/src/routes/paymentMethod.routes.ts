import { Router } from 'express';
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
} from '../controllers/paymentMethod.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import {
  createPaymentMethodSchema,
  idParams,
  paymentMethodQuery,
  updatePaymentMethodSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

// Anyone signed in needs the list to fill a picker; only admins change it.
router.get('/', validate({ query: paymentMethodQuery }), listPaymentMethods);
router.get('/:id', validate({ params: idParams }), getPaymentMethod);
router.post('/', requireAdmin, validate({ body: createPaymentMethodSchema }), createPaymentMethod);
router.patch(
  '/:id',
  requireAdmin,
  validate({ params: idParams, body: updatePaymentMethodSchema }),
  updatePaymentMethod,
);
router.delete('/:id', requireAdmin, validate({ params: idParams }), deletePaymentMethod);

export default router;
