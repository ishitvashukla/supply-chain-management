import type { Request, Response } from 'express';
import { optionalStoreScope, resolveStoreScope } from '../middlewares/auth';
import expenseService from '../services/expense.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, storeId, category, from, to, search } = req.query as Record<string, never>;
  const scopedStore = optionalStoreScope(req, storeId);
  const { items, meta } = await expenseService.list({
    page,
    limit,
    category,
    from,
    to,
    search,
    store: scopedStore,
  });
  return sendSuccess(res, { message: 'Expenses fetched', data: items, meta });
});

export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await expenseService.getById(req.params.id as string);
  return sendSuccess(res, { message: 'Expense fetched', data: expense });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const storeId = resolveStoreScope(req, req.body.store);
  const expense = await expenseService.create({ ...req.body, store: storeId }, req.user.id);
  return sendSuccess(res, { statusCode: 201, message: 'Expense recorded', data: expense });
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await expenseService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Expense updated', data: expense });
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await expenseService.remove(req.params.id as string);
  return sendSuccess(res, { message: 'Expense deleted' });
});

export const expenseBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, from, to } = req.query as Record<string, never>;
  const scopedStore = optionalStoreScope(req, storeId);
  const rows = await expenseService.breakdown({ store: scopedStore, from, to });
  return sendSuccess(res, { message: 'Expense breakdown', data: rows });
});
