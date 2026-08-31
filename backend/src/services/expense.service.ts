import { Types } from 'mongoose';
import type { ExpenseCategory } from '../constants';
import Expense, { type IExpense } from '../models/expense.model';
import ApiError from '../utils/ApiError';

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  store?: string;
  category?: ExpenseCategory;
  from?: Date;
  to?: Date;
  search?: string;
}

export const expenseService = {
  async list({ page = 1, limit = 20, store, category, from, to, search }: ExpenseFilters = {}) {
    const filter: Record<string, unknown> = {};
    if (store) filter.store = store;
    if (category) filter.category = category;
    if (search) filter.title = new RegExp(search, 'i');
    if (from || to) {
      filter.incurredAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Expense.find(filter)
        .populate('store', 'name code')
        .populate('recordedBy', 'name')
        .sort('-incurredAt')
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(filter),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  },

  async getById(id: string) {
    const expense = await Expense.findById(id).populate('store', 'name code');
    if (!expense) throw ApiError.notFound('Expense not found');
    return expense;
  },

  async create(payload: Partial<IExpense>, actorId: string) {
    return Expense.create({ ...payload, recordedBy: actorId });
  },

  async update(id: string, payload: Partial<IExpense>) {
    const expense = await Expense.findByIdAndUpdate(id, payload, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!expense) throw ApiError.notFound('Expense not found');
    return expense;
  },

  async remove(id: string) {
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) throw ApiError.notFound('Expense not found');
    return expense;
  },

  /** Spend split by category over a window — feeds the expenses chart. */
  async breakdown({ store, from, to }: { store?: string; from?: Date; to?: Date } = {}) {
    const match: Record<string, unknown> = {};
    if (store) match.store = new Types.ObjectId(store);
    if (from || to) {
      match.incurredAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    return Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
      { $sort: { total: -1 } },
    ]);
  },
};

export default expenseService;
