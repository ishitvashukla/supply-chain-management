import {
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  PAYMENT_STATUS,
  ROLES,
  STOCK_MOVEMENT,
  type OrderPriority,
  type OrderStatus,
} from '../constants';
import { nextSequence } from '../models/counter.model';
import Order, { type IOrder, type IOrderItem } from '../models/order.model';
import Product from '../models/product.model';
import Store from '../models/store.model';
import StoreItem from '../models/storeItem.model';
import ApiError from '../utils/ApiError';
import { toIso } from '../utils/date';
import stockService from './stock.service';

export interface OrderLineInput {
  product: string;
  quantity: number;
}

export interface CreateOrderInput {
  store: string;
  items: OrderLineInput[];
  priority?: OrderPriority;
  requestedDeliveryDate?: Date | null;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  notes?: string;
  deliveryFee?: number;
  discount?: number;
  /** Submit straight for approval instead of leaving a draft. */
  submit?: boolean;
}

export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: string;
  store?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

const round = (value: number): number => Number(value.toFixed(2));

/**
 * Prices a basket from the catalog, honouring each store's price override.
 * Prices are snapshotted onto the line so later catalog edits can't rewrite history.
 */
const buildLines = async (storeId: string, lines: OrderLineInput[]): Promise<IOrderItem[]> => {
  if (!lines.length) throw ApiError.badRequest('An order must contain at least one item');

  const productIds = lines.map((line) => line.product);
  const [products, storeItems] = await Promise.all([
    Product.find({ _id: { $in: productIds } }),
    StoreItem.find({ store: storeId, product: { $in: productIds } }),
  ]);

  const productById = new Map(products.map((product) => [String(product.id), product]));
  const overrideByProduct = new Map(storeItems.map((item) => [String(item.product), item]));

  return lines.map((line) => {
    const product = productById.get(line.product);
    if (!product) throw ApiError.notFound(`Product ${line.product} not found`);
    if (!product.isActive) throw ApiError.badRequest(`Product ${product.name} is inactive`);

    const storeItem = overrideByProduct.get(line.product);
    if (storeItem && !storeItem.isAvailable) {
      throw ApiError.badRequest(`${product.name} is not available at this store`);
    }

    const unitPrice = storeItem?.price ?? product.basePrice;
    const gross = unitPrice * line.quantity;
    const taxPercentage = product.taxes.reduce((sum, tax) => sum + tax.percentage, 0);
    const taxAmount = round((gross * taxPercentage) / 100);

    return {
      product: product._id,
      name: product.name,
      code: product.code,
      packSize: product.packSize,
      unit: product.unit,
      quantity: line.quantity,
      unitPrice: round(unitPrice),
      taxPercentage,
      taxAmount,
      lineTotal: round(gross + taxAmount),
    } as IOrderItem;
  });
};

const applyTotals = (order: IOrder): void => {
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = order.items.reduce((sum, item) => sum + item.taxAmount, 0);
  order.subtotal = round(subtotal);
  order.taxTotal = round(taxTotal);
  order.total = round(Math.max(0, subtotal + taxTotal + order.deliveryFee - order.discount));
};

export const orderService = {
  async create(input: CreateOrderInput, actor: { id: string; role: string }) {
    const store = await Store.findById(input.store);
    if (!store) throw ApiError.notFound('Store not found');
    if (!store.isActive) throw ApiError.badRequest('Store is inactive');

    const items = await buildLines(input.store, input.items);
    const seq = await nextSequence('order');
    const status = input.submit ? ORDER_STATUS.PENDING : ORDER_STATUS.DRAFT;

    const order = new Order({
      orderNumber: `PO-${String(seq).padStart(5, '0')}`,
      store: input.store,
      placedBy: actor.id,
      placedByAdmin: actor.role === ROLES.ADMIN,
      status,
      priority: input.priority,
      items,
      deliveryFee: input.deliveryFee ?? 0,
      discount: input.discount ?? 0,
      requestedDeliveryDate: input.requestedDeliveryDate ?? null,
      deliveryAddress: input.deliveryAddress,
      deliveryInstructions: input.deliveryInstructions,
      notes: input.notes,
      timeline: [{ status, at: new Date(), by: actor.id as never, note: 'Order created' }],
    });

    applyTotals(order);
    await order.save();
    return order;
  },

  async list({ page = 1, limit = 20, status, paymentStatus, store, search, from, to }: OrderFilters = {}) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (store) filter.store = store;
    if (search) filter.orderNumber = new RegExp(search, 'i');
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate('store', 'name code')
        .populate('placedBy', 'name email role')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  },

  async getById(id: string) {
    const order = await Order.findById(id)
      .populate('store', 'name code address currency')
      .populate('placedBy', 'name email role')
      .populate('approvedBy', 'name email');
    if (!order) throw ApiError.notFound('Order not found');
    return order;
  },

  /** Drafts stay editable; anything submitted is frozen. */
  async update(id: string, input: Partial<CreateOrderInput>) {
    const order = await Order.findById(id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status !== ORDER_STATUS.DRAFT) {
      throw ApiError.badRequest(`Only draft orders can be edited (this one is ${order.status})`);
    }

    if (input.items) order.items = await buildLines(String(order.store), input.items);
    if (input.priority) order.priority = input.priority;
    if (input.deliveryFee !== undefined) order.deliveryFee = input.deliveryFee;
    if (input.discount !== undefined) order.discount = input.discount;
    if (input.requestedDeliveryDate !== undefined) {
      order.requestedDeliveryDate = input.requestedDeliveryDate;
    }
    if (input.deliveryAddress !== undefined) order.deliveryAddress = input.deliveryAddress;
    if (input.deliveryInstructions !== undefined) {
      order.deliveryInstructions = input.deliveryInstructions;
    }
    if (input.notes !== undefined) order.notes = input.notes;

    applyTotals(order);
    await order.save();
    return order;
  },

  /**
   * The single gate for status changes. Every transition is checked against
   * ORDER_TRANSITIONS, so no caller can move an order somewhere illegal.
   */
  async transition(
    id: string,
    to: OrderStatus,
    actor: { id: string },
    opts: { note?: string; reason?: string } = {},
  ) {
    const order = await Order.findById(id);
    if (!order) throw ApiError.notFound('Order not found');

    const allowed = ORDER_TRANSITIONS[order.status];
    if (!allowed.includes(to)) {
      throw ApiError.badRequest(
        `Cannot move an order from ${order.status} to ${to}` +
          (allowed.length ? `. Allowed: ${allowed.join(', ')}` : ' — it is in a final state'),
      );
    }

    order.status = to;
    order.timeline.push({
      status: to,
      at: new Date(),
      by: actor.id as never,
      note: opts.note ?? opts.reason,
    });

    if (to === ORDER_STATUS.APPROVED) {
      order.approvedBy = actor.id as never;
      order.approvedAt = new Date();
    }
    if (to === ORDER_STATUS.REJECTED) {
      order.rejectionReason = opts.reason;
    }
    if (to === ORDER_STATUS.FULFILLED) {
      order.fulfilledAt = new Date();
      // Delivery is what actually puts stock on the shelf.
      await stockService.applyOrderReceipt(order, actor.id);
    }

    await order.save();
    return order;
  },

  /** Keeps the order's payment rollup in step with its payment records. */
  async recalculatePayments(orderId: string, paidTotal: number) {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');

    order.amountPaid = round(paidTotal);
    if (order.amountPaid <= 0) order.paymentStatus = PAYMENT_STATUS.PENDING;
    else if (order.amountPaid + 0.001 < order.total) order.paymentStatus = PAYMENT_STATUS.PARTIAL;
    else order.paymentStatus = PAYMENT_STATUS.PAID;

    await order.save();
    return order;
  },

  /** Everything awaiting an admin decision. */
  async pendingApproval(storeId?: string) {
    const filter: Record<string, unknown> = { status: ORDER_STATUS.PENDING };
    if (storeId) filter.store = storeId;
    return Order.find(filter).populate('store', 'name code').populate('placedBy', 'name').sort('-createdAt');
  },

  summaryLabel: (order: IOrder): string =>
    `${order.orderNumber} · ${order.items.length} item(s) · ${toIso(order.createdAt)}`,

  constants: { STOCK_MOVEMENT },
};

export default orderService;
