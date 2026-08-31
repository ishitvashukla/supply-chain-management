import { PAYMENT_STATUS, type PaymentStatus } from '../constants';
import PaymentMethodModel from '../models/paymentMethod.model';
import { nextSequence } from '../models/counter.model';
import Order, { type IFieldChange, type OrderActivityType } from '../models/order.model';
import Payment from '../models/payment.model';
import ApiError from '../utils/ApiError';
import orderService from './order.service';

export interface CreatePaymentInput {
  order: string;
  amount: number;
  method?: string;
  status?: PaymentStatus;
  paidAt?: Date | null;
  dueDate?: Date | null;
  transactionId?: string;
  receiptImage?: string;
  notes?: string;
}

export interface UpdatePaymentInput {
  amount?: number;
  method?: string;
  status?: PaymentStatus;
  paidAt?: Date | null;
  dueDate?: Date | null;
  transactionId?: string;
  receiptImage?: string;
  notes?: string;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  store?: string;
  order?: string;
  status?: PaymentStatus;
  from?: Date;
  to?: Date;
}

const round = (value: number): number => Number(value.toFixed(2));

/** A payment may only use a method that exists and is still active. */
const assertMethod = async (code?: string): Promise<void> => {
  if (!code) return;
  const method = await PaymentMethodModel.findOne({ code: code.toUpperCase() });
  if (!method) throw ApiError.badRequest(`Unknown payment method: ${code}`);
  if (!method.isActive) throw ApiError.badRequest(`Payment method ${method.name} is inactive`);
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
};

/** Only fields that actually changed are recorded. */
const diff = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): IFieldChange[] =>
  Object.keys(after)
    .filter((key) => asText(before[key]) !== asText(after[key]))
    .map((key) => ({ field: key, from: asText(before[key]), to: asText(after[key]) }));

/**
 * Appends an audit entry to the order. Uses an atomic $push rather than
 * loading and saving the document, so a concurrent write can't drop it.
 */
const recordActivity = async (
  orderId: unknown,
  entry: {
    type: OrderActivityType;
    by: string;
    reference?: string;
    payment?: unknown;
    changes?: IFieldChange[];
    note?: string;
  },
): Promise<void> => {
  await Order.updateOne(
    { _id: orderId },
    {
      $push: {
        activity: {
          type: entry.type,
          at: new Date(),
          by: entry.by,
          reference: entry.reference,
          payment: entry.payment ?? null,
          changes: entry.changes ?? [],
          note: entry.note,
        },
      },
    },
  );
};

/**
 * Sum of settled payments against an order.
 * `excludeId` leaves one payment out, so an edit is checked against the other
 * payments rather than against its own previous amount.
 */
const paidTotalFor = async (orderId: string, excludeId?: string): Promise<number> => {
  const filter: Record<string, unknown> = { order: orderId, status: PAYMENT_STATUS.PAID };
  if (excludeId) filter._id = { $ne: excludeId };
  const rows = await Payment.find(filter);
  return round(rows.reduce((sum, row) => sum + row.amount, 0));
};

export const paymentService = {
  async create(input: CreatePaymentInput, actorId: string) {
    const order = await Order.findById(input.order);
    if (!order) throw ApiError.notFound('Order not found');

    await assertMethod(input.method);

    const alreadyPaid = await paidTotalFor(input.order);
    const status = input.status ?? PAYMENT_STATUS.PAID;

    // Only settled money counts toward the cap.
    if (status === PAYMENT_STATUS.PAID && alreadyPaid + input.amount > order.total + 0.001) {
      throw ApiError.badRequest(
        `Payment exceeds the balance due (${round(order.total - alreadyPaid)} remaining)`,
      );
    }

    const seq = await nextSequence('payment');
    const payment = await Payment.create({
      reference: `PAY-${String(seq).padStart(5, '0')}`,
      order: order._id,
      store: order.store,
      amount: input.amount,
      method: input.method,
      status,
      paidAt: status === PAYMENT_STATUS.PAID ? (input.paidAt ?? new Date()) : input.paidAt,
      dueDate: input.dueDate ?? null,
      transactionId: input.transactionId,
      receiptImage: input.receiptImage,
      notes: input.notes,
      recordedBy: actorId,
    });

    await recordActivity(order._id, {
      type: 'PAYMENT_RECORDED',
      by: actorId,
      reference: payment.reference,
      payment: payment._id,
      changes: [
        { field: 'amount', from: '—', to: asText(payment.amount) },
        { field: 'method', from: '—', to: asText(payment.method) },
        { field: 'status', from: '—', to: asText(payment.status) },
      ],
    });

    await orderService.recalculatePayments(String(order.id), await paidTotalFor(input.order));
    return payment;
  },

  async list({ page = 1, limit = 20, store, order, status, from, to }: PaymentFilters = {}) {
    const filter: Record<string, unknown> = {};
    if (store) filter.store = store;
    if (order) filter.order = order;
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate('order', 'orderNumber total status')
        .populate('store', 'name code')
        .populate('recordedBy', 'name')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  },

  async getById(id: string) {
    // `+receiptImage` — excluded from lists by default, wanted on the detail.
    const payment = await Payment.findById(id)
      .select('+receiptImage')
      .populate('order', 'orderNumber total status')
      .populate('store', 'name code')
      .populate('recordedBy', 'name');
    if (!payment) throw ApiError.notFound('Payment not found');
    return payment;
  },

  /**
   * Edits a recorded payment. Changing the amount re-checks it against the
   * order's balance (ignoring this payment's old value) and re-derives the
   * order's payment rollup, so the two can never disagree.
   */
  async update(id: string, input: UpdatePaymentInput, actorId: string) {
    const payment = await Payment.findById(id);
    if (!payment) throw ApiError.notFound('Payment not found');

    const order = await Order.findById(payment.order);
    if (!order) throw ApiError.notFound('Order not found');

    await assertMethod(input.method);

    const nextStatus = input.status ?? payment.status;
    const nextAmount = input.amount ?? payment.amount;

    if (nextStatus === PAYMENT_STATUS.PAID) {
      const otherPaid = await paidTotalFor(String(payment.order), id);
      if (otherPaid + nextAmount > order.total + 0.001) {
        throw ApiError.badRequest(
          `Payment exceeds the balance due (${round(order.total - otherPaid)} remaining)`,
        );
      }
    }

    // Snapshot before mutating so the diff reflects what actually changed.
    const before = {
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      dueDate: payment.dueDate,
      transactionId: payment.transactionId,
      notes: payment.notes,
    };

    if (input.amount !== undefined) payment.amount = input.amount;
    if (input.method !== undefined) payment.method = input.method;
    if (input.status !== undefined) payment.status = input.status;
    if (input.dueDate !== undefined) payment.dueDate = input.dueDate;
    if (input.transactionId !== undefined) payment.transactionId = input.transactionId;
    if (input.receiptImage !== undefined) payment.receiptImage = input.receiptImage;
    if (input.notes !== undefined) payment.notes = input.notes;

    if (input.paidAt !== undefined) {
      payment.paidAt = input.paidAt;
    } else if (nextStatus === PAYMENT_STATUS.PAID && !payment.paidAt) {
      // Marking something paid without a date should still stamp one.
      payment.paidAt = new Date();
    }

    await payment.save();

    const changes = diff(before, {
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      dueDate: payment.dueDate,
      transactionId: payment.transactionId,
      notes: payment.notes,
    });

    // A no-op edit is not worth an audit entry.
    if (changes.length) {
      await recordActivity(payment.order, {
        type: 'PAYMENT_UPDATED',
        by: actorId,
        reference: payment.reference,
        payment: payment._id,
        changes,
      });
    }

    await orderService.recalculatePayments(
      String(payment.order),
      await paidTotalFor(String(payment.order)),
    );

    return payment;
  },

  async updateStatus(id: string, status: PaymentStatus, notes?: string, actorId?: string) {
    const payment = await Payment.findById(id);
    if (!payment) throw ApiError.notFound('Payment not found');

    const previousStatus = payment.status;
    payment.status = status;
    if (status === PAYMENT_STATUS.PAID && !payment.paidAt) payment.paidAt = new Date();
    if (notes) payment.notes = notes;
    await payment.save();

    if (previousStatus !== status && actorId) {
      await recordActivity(payment.order, {
        type: 'PAYMENT_UPDATED',
        by: actorId,
        reference: payment.reference,
        payment: payment._id,
        changes: [{ field: 'status', from: previousStatus, to: status }],
        note: notes,
      });
    }

    await orderService.recalculatePayments(
      String(payment.order),
      await paidTotalFor(String(payment.order)),
    );
    return payment;
  },

  async remove(id: string, actorId?: string) {
    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) throw ApiError.notFound('Payment not found');

    if (actorId) {
      await recordActivity(payment.order, {
        type: 'PAYMENT_DELETED',
        by: actorId,
        reference: payment.reference,
        changes: [{ field: 'amount', from: asText(payment.amount), to: '—' }],
      });
    }

    await orderService.recalculatePayments(
      String(payment.order),
      await paidTotalFor(String(payment.order)),
    );
    return payment;
  },

  /** Outstanding balance per store, for the payments dashboard. */
  async outstandingByStore() {
    return Order.aggregate([
      { $match: { $expr: { $gt: ['$total', '$amountPaid'] } } },
      {
        $group: {
          _id: '$store',
          outstanding: { $sum: { $subtract: ['$total', '$amountPaid'] } },
          orders: { $sum: 1 },
        },
      },
      { $lookup: { from: 'stores', localField: '_id', foreignField: '_id', as: 'store' } },
      { $unwind: '$store' },
      {
        $project: {
          _id: 0,
          storeId: '$_id',
          storeName: '$store.name',
          storeCode: '$store.code',
          outstanding: { $round: ['$outstanding', 2] },
          orders: 1,
        },
      },
      { $sort: { outstanding: -1 } },
    ]);
  },
};

export default paymentService;
