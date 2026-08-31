import { Types } from 'mongoose';
import { INBOUND_MOVEMENTS, type StockMovement } from '../constants';
import type { OrderDocument } from '../models/order.model';
import StockMovementModel from '../models/stockMovement.model';
import StoreItem from '../models/storeItem.model';
import ApiError from '../utils/ApiError';

export interface MovementInput {
  store: string;
  product: string;
  type: StockMovement;
  quantity: number;
  note?: string;
  order?: string | null;
  occurredAt?: Date;
}

/**
 * Every stock change goes through here: it updates the running quantity on the
 * StoreItem and writes an immutable ledger row, so the two can never drift.
 */
export const stockService = {
  async record(input: MovementInput, actorId: string) {
    if (input.quantity <= 0) throw ApiError.badRequest('Quantity must be greater than zero');

    const item = await StoreItem.findOne({ store: input.store, product: input.product });
    if (!item) {
      throw ApiError.notFound('This store does not stock that product; add it to the store first');
    }

    const isInbound = INBOUND_MOVEMENTS.includes(input.type);
    const delta = isInbound ? input.quantity : -input.quantity;
    const balanceAfter = item.quantityOnHand + delta;

    if (balanceAfter < 0) {
      throw ApiError.badRequest(
        `Insufficient stock: ${item.quantityOnHand} on hand, tried to remove ${input.quantity}`,
      );
    }

    item.quantityOnHand = balanceAfter;
    if (isInbound) item.lastRestockedAt = new Date();
    await item.save();

    const movement = await StockMovementModel.create({
      store: input.store,
      product: input.product,
      type: input.type,
      quantity: input.quantity,
      delta,
      balanceAfter,
      order: input.order ?? null,
      performedBy: actorId,
      note: input.note,
      occurredAt: input.occurredAt ?? new Date(),
    });

    return { movement, storeItem: item };
  },

  /** Receipt of an entire fulfilled order. */
  async applyOrderReceipt(order: OrderDocument, actorId: string) {
    for (const line of order.items) {
      const item = await StoreItem.findOne({ store: order.store, product: line.product });
      // A product that the store no longer stocks is skipped rather than fatal —
      // the order itself is still valid history.
      if (!item) continue;

      item.quantityOnHand += line.quantity;
      item.lastRestockedAt = new Date();
      await item.save();

      await StockMovementModel.create({
        store: order.store,
        product: line.product,
        type: 'RECEIPT',
        quantity: line.quantity,
        delta: line.quantity,
        balanceAfter: item.quantityOnHand,
        order: order._id,
        performedBy: actorId,
        note: `Received against ${order.orderNumber}`,
      });
    }
  },

  async list(filters: {
    store?: string;
    product?: string;
    type?: StockMovement;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, store, product, type, from, to } = filters;
    const filter: Record<string, unknown> = {};
    if (store) filter.store = store;
    if (product) filter.product = product;
    if (type) filter.type = type;
    if (from || to) {
      filter.occurredAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      StockMovementModel.find(filter)
        .populate('product', 'name code unit')
        .populate('store', 'name code')
        .populate('performedBy', 'name')
        .sort('-occurredAt')
        .skip(skip)
        .limit(limit),
      StockMovementModel.countDocuments(filter),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  },

  /**
   * Recomputes avgDailyUsage from outbound movements so the reorder forecast
   * reflects what the store actually burns.
   */
  async recomputeUsage(storeId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await StockMovementModel.aggregate<{ _id: Types.ObjectId; consumed: number }>([
      {
        $match: {
          store: new Types.ObjectId(storeId),
          occurredAt: { $gte: since },
          delta: { $lt: 0 },
        },
      },
      { $group: { _id: '$product', consumed: { $sum: { $abs: '$delta' } } } },
    ]);

    let updated = 0;
    for (const row of usage) {
      const result = await StoreItem.updateOne(
        { store: storeId, product: row._id },
        { $set: { avgDailyUsage: Number((row.consumed / days).toFixed(4)) } },
      );
      updated += result.modifiedCount;
    }

    return { updated, windowDays: days };
  },
};

export default stockService;
