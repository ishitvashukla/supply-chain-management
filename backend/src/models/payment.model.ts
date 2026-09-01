import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  type PaymentStatus,
} from '../constants';
import { tenantPlugin, tenantUnique } from './plugins/tenant.plugin';

/** One payment record against an order. Orders may be paid in instalments. */
export interface IPayment {
  reference: string;
  order: Types.ObjectId;
  store: Types.ObjectId;
  amount: number;
  /**
   * Code of a PaymentMethod. Not an enum: methods are user-managed, and the
   * code is stored rather than a reference so renaming one never rewrites
   * historical payments.
   */
  method: string;
  status: PaymentStatus;
  paidAt?: Date | null;
  dueDate?: Date | null;
  transactionId?: string;
  /**
   * Proof of payment — a screenshot or receipt, stored inline as a base64 data
   * URL. `select: false` keeps it out of list queries, which would otherwise
   * carry a megabyte per row.
   */
  receiptImage?: string;
  recordedBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Virtual */
  isOverdue?: boolean;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    reference: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than zero'] },
    method: { type: String, uppercase: true, trim: true, default: PAYMENT_METHOD.BANK_TRANSFER },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paidAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    transactionId: { type: String, trim: true },
    receiptImage: { type: String, select: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

paymentSchema.index({ store: 1, createdAt: -1 });

paymentSchema.virtual('isOverdue').get(function (this: IPayment): boolean {
  if (this.status === PAYMENT_STATUS.PAID || !this.dueDate) return false;
  return this.dueDate.getTime() < Date.now();
});

tenantUnique(paymentSchema, { reference: 1 });

paymentSchema.plugin(tenantPlugin);

export const Payment: Model<IPayment> = model<IPayment>('Payment', paymentSchema);
export default Payment;
