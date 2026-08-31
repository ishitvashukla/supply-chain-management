import { Router } from 'express';
import {
  createExpense,
  deleteExpense,
  expenseBreakdown,
  getExpense,
  listExpenses,
  updateExpense,
} from '../controllers/expense.controller';
import { authenticate, validate } from '../middlewares';
import { createExpenseSchema, expenseQuery, idParams, updateExpenseSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: expenseQuery }), listExpenses);
router.get('/breakdown', expenseBreakdown);
router.post('/', validate({ body: createExpenseSchema }), createExpense);
router.get('/:id', validate({ params: idParams }), getExpense);
router.patch('/:id', validate({ params: idParams, body: updateExpenseSchema }), updateExpense);
router.delete('/:id', validate({ params: idParams }), deleteExpense);

export default router;
