import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../controllers/product.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import { createProductSchema, idParams, productQuery, updateProductSchema } from '../validators';

const router = Router();

router.use(authenticate);

// Any signed-in user browses the catalog; only admins change it.
router.get('/', validate({ query: productQuery }), listProducts);
router.get('/:id', validate({ params: idParams }), getProduct);
router.post('/', requireAdmin, validate({ body: createProductSchema }), createProduct);
router.patch('/:id', requireAdmin, validate({ params: idParams, body: updateProductSchema }), updateProduct);
router.delete('/:id', requireAdmin, validate({ params: idParams }), deleteProduct);

export default router;
