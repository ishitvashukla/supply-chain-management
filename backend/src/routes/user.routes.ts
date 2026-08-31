import { Router } from 'express';
import { deleteUser, getUser, listUsers, updateUser } from '../controllers/user.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import { idParams, paginationQuery, updateUserSchema } from '../validators';

const router = Router();

// Managing accounts is admin-only across the board.
router.use(authenticate, requireAdmin);

router.get('/', validate({ query: paginationQuery }), listUsers);
router.get('/:id', validate({ params: idParams }), getUser);
router.patch('/:id', validate({ params: idParams, body: updateUserSchema }), updateUser);
router.delete('/:id', validate({ params: idParams }), deleteUser);

export default router;
