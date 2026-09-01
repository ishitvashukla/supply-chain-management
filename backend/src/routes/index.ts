import { Router } from 'express';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import expenseRoutes from './expense.routes';
import healthRoutes from './health.routes';
import inventoryRoutes from './inventory.routes';
import orderRoutes from './order.routes';
import paymentMethodRoutes from './paymentMethod.routes';
import paymentRoutes from './payment.routes';
import productRoutes from './product.routes';
import statsRoutes from './stats.routes';
import storeRoutes, { storeItemRouter } from './store.routes';
import turnsProxyRoutes from './turnsProxy.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/stores', storeRoutes);
router.use('/store-items', storeItemRouter);
router.use('/catalog', catalogRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/stats', statsRoutes);
// Relay for the turns backend — the browser cannot call it cross-origin.
router.use('/turns', turnsProxyRoutes);

export default router;
