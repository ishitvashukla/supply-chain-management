import { Types } from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS, STOCK_HEALTH } from '../constants';
import Expense from '../models/expense.model';
import Order from '../models/order.model';
import StockMovementModel from '../models/stockMovement.model';
import Store from '../models/store.model';
import StoreItem from '../models/storeItem.model';
import { dayjs } from '../utils/date';

const round = (value: number): number => Number(value.toFixed(2));
const scope = (storeId?: string) => (storeId ? { store: new Types.ObjectId(storeId) } : {});

/**
 * Read-only aggregations for the dashboards. Everything is scoped by store
 * when a storeId is supplied, so store users see only their own numbers.
 */
export const statsService = {
  /** Headline KPI tiles. */
  async overview(storeId?: string) {
    const match = scope(storeId);

    const [activeStores, openOrders, pendingApproval, stockRows, outstanding, monthExpenses] =
      await Promise.all([
        storeId ? Promise.resolve(1) : Store.countDocuments({ isActive: true }),
        Order.countDocuments({
          ...match,
          status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.APPROVED] },
        }),
        Order.countDocuments({ ...match, status: ORDER_STATUS.PENDING }),
        StoreItem.find(storeId ? { store: storeId } : {}),
        Order.aggregate<{ total: number; count: number }>([
          { $match: { ...match, $expr: { $gt: ['$total', '$amountPaid'] } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $subtract: ['$total', '$amountPaid'] } },
              count: { $sum: 1 },
            },
          },
        ]),
        Expense.aggregate<{ total: number }>([
          {
            $match: {
              ...match,
              incurredAt: { $gte: dayjs().startOf('month').toDate() },
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

    const atRisk = stockRows.filter((row) => row.get('stockHealth') !== STOCK_HEALTH.OK);
    const storesAtRisk = new Set(atRisk.map((row) => String(row.store))).size;

    return {
      activeStores,
      openOrders,
      pendingApproval,
      itemsAtRisk: atRisk.length,
      storesAtRisk,
      outstandingAmount: round(outstanding[0]?.total ?? 0),
      outstandingOrders: outstanding[0]?.count ?? 0,
      expensesThisMonth: round(monthExpenses[0]?.total ?? 0),
    };
  },

  /** Order count and value per day, for the trend chart. */
  async orderTrend({ storeId, days = 30 }: { storeId?: string; days?: number } = {}) {
    const since = dayjs().subtract(days, 'day').startOf('day').toDate();

    return Order.aggregate([
      { $match: { ...scope(storeId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
      { $project: { _id: 0, date: '$_id', orders: 1, value: { $round: ['$value', 2] } } },
      { $sort: { date: 1 } },
    ]);
  },

  /** How many orders sit in each state right now. */
  async ordersByStatus(storeId?: string) {
    return Order.aggregate([
      { $match: scope(storeId) },
      { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$total' } } },
      { $project: { _id: 0, status: '$_id', count: 1, value: { $round: ['$value', 2] } } },
      { $sort: { count: -1 } },
    ]);
  },

  /** Most consumed products by outbound movement. */
  async topConsumed({ storeId, days = 30, limit = 10 }: { storeId?: string; days?: number; limit?: number } = {}) {
    const since = dayjs().subtract(days, 'day').toDate();

    return StockMovementModel.aggregate([
      { $match: { ...scope(storeId), occurredAt: { $gte: since }, delta: { $lt: 0 } } },
      { $group: { _id: '$product', consumed: { $sum: { $abs: '$delta' } } } },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: '$product.name',
          code: '$product.code',
          unit: '$product.unit',
          consumed: { $round: ['$consumed', 2] },
        },
      },
      { $sort: { consumed: -1 } },
      { $limit: limit },
    ]);
  },

  /**
   * Items that will run out soonest, with a suggested reorder quantity —
   * enough to cover 30 days at the current burn rate.
   */
  async reorderForecast({ storeId, limit = 20 }: { storeId?: string; limit?: number } = {}) {
    const rows = await StoreItem.find(storeId ? { store: storeId } : {})
      .populate('product', 'name code unit')
      .populate('store', 'name code');

    return rows
      .map((row) => {
        const daysOfCover = row.get('daysOfCover') as number | null;
        const suggested =
          row.avgDailyUsage > 0
            ? Math.max(0, Math.ceil(row.avgDailyUsage * 30 - row.quantityOnHand))
            : Math.max(0, row.reorderThreshold - row.quantityOnHand);

        return {
          storeItemId: String(row.id),
          store: row.store,
          product: row.product,
          quantityOnHand: row.quantityOnHand,
          avgDailyUsage: row.avgDailyUsage,
          daysOfCover,
          stockHealth: row.get('stockHealth') as string,
          suggestedQuantity: suggested,
          depletionDate:
            daysOfCover !== null ? dayjs().add(daysOfCover, 'day').toISOString() : null,
        };
      })
      .filter((row) => row.suggestedQuantity > 0 || row.stockHealth !== STOCK_HEALTH.OK)
      .sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity))
      .slice(0, limit);
  },

  /** Inventory value and expense totals side by side. */
  async financials({ storeId, days = 30 }: { storeId?: string; days?: number } = {}) {
    const since = dayjs().subtract(days, 'day').toDate();

    const [inventoryValue, spend, paid] = await Promise.all([
      StoreItem.aggregate<{ value: number }>([
        { $match: scope(storeId) },
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        {
          $group: {
            _id: null,
            value: {
              $sum: {
                $multiply: ['$quantityOnHand', { $ifNull: ['$price', '$p.basePrice'] }],
              },
            },
          },
        },
      ]),
      Expense.aggregate<{ total: number }>([
        { $match: { ...scope(storeId), incurredAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Order.aggregate<{ total: number }>([
        {
          $match: {
            ...scope(storeId),
            paymentStatus: PAYMENT_STATUS.PAID,
            createdAt: { $gte: since },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
    ]);

    return {
      windowDays: days,
      inventoryValue: round(inventoryValue[0]?.value ?? 0),
      expenses: round(spend[0]?.total ?? 0),
      ordersPaid: round(paid[0]?.total ?? 0),
    };
  },
};

export default statsService;
