import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import {
  ORDER_PRIORITY,
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  type OrderPriority,
  type OrderStatus,
  type PaymentStatus,
} from '../constants';
import { tenantPlugin, tenantUnique } from './plugins/tenant.plugin';

/**
 * Line items snapshot name/code/price at order time. Editing a product later
 * must never rewrite the history of an order already placed.
 */
export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  code: string;
  packSize: number;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  taxAmount: number;
  lineTotal: number;
}

export interface IOrderEvent {
  status: OrderStatus;
  at: Date;
  by?: Types.ObjectId | null;
  note?: string;
}

/** What kind of change an activity entry records. */
export type OrderActivityType =
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_DELETED';

/** A single field that changed, captured as human-readable before/after. */
export interface IFieldChange {
  field: string;
  from: string;
  to: string;
}

/**
 * Audit trail of money movements against the order, kept separate from
 * `timeline` (which tracks the order's own status). Every payment edit lands
 * here with a field-level diff, so a changed amount is always traceable.
 */
export interface IOrderActivity {
  type: OrderActivityType;
  at: Date;
  by?: Types.ObjectId | null;
  /** e.g. PAY-00004 — kept even after the payment row is deleted. */
  reference?: string;
  payment?: Types.ObjectId | null;
  changes: IFieldChange[];
  note?: string;
}

export interface IOrder {
  orderNumber: string;
  store: Types.ObjectId;
  /** Who submitted it — a store user, or an admin ordering on the store's behalf. */
  placedBy: Types.ObjectId;
  /** True when an admin raised this for a store rather than the store itself. */
  placedByAdmin: boolean;
  status: OrderStatus;
  priority: OrderPriority;
  items: IOrderItem[];
  subtotal: number;
  taxTotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  requestedDeliveryDate?: Date | null;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  notes?: string;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  rejectionReason?: string;
  fulfilledAt?: Date | null;
  timeline: IOrderEvent[];
  activity: IOrderActivity[];
  createdAt: Date;
  updatedAt: Date;
  /** Virtual */
  balanceDue?: number;
}

export type OrderDocument = HydratedDocument<IOrder>;

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    packSize: { type: Number, default: 1 },
    unit: { type: String, default: 'unit' },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    unitPrice: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderEventSchema = new Schema<IOrderEvent>(
  {
    status: { type: String, enum: ORDER_STATUS_VALUES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const fieldChangeSchema = new Schema<IFieldChange>(
  {
    field: { type: String, required: true },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
  },
  { _id: false },
);

const orderActivitySchema = new Schema<IOrderActivity>(
  {
    type: {
      type: String,
      enum: ['PAYMENT_RECORDED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED'],
      required: true,
    },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reference: { type: String },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    changes: { type: [fieldChangeSchema], default: [] },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    placedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    placedByAdmin: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: ORDER_STATUS.DRAFT,
      index: true,
    },
    priority: {
      type: String,
      enum: ORDER_PRIORITY_VALUES,
      default: ORDER_PRIORITY.STANDARD,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    subtotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    requestedDeliveryDate: { type: Date, default: null },
    deliveryAddress: { type: String, trim: true },
    deliveryInstructions: { type: String, trim: true },
    notes: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true },
    fulfilledAt: { type: Date, default: null },
    timeline: { type: [orderEventSchema], default: [] },
    activity: { type: [orderActivitySchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

orderSchema.index({ store: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

orderSchema.virtual('balanceDue').get(function (this: IOrder): number {
  return Math.max(0, Number((this.total - this.amountPaid).toFixed(2)));
});

tenantUnique(orderSchema, { orderNumber: 1 });

orderSchema.plugin(tenantPlugin);

export const Order: Model<IOrder> = model<IOrder>('Order', orderSchema);
export default Order;
