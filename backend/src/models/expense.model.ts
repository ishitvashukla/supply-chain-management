import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import {
  EXPENSE_CATEGORY,
  EXPENSE_CATEGORY_VALUES,
  PAYMENT_METHOD,
  type ExpenseCategory,
} from '../constants';
import { tenantPlugin } from './plugins/tenant.plugin';

/** Store spend that isn't a purchase order — utilities, payroll, rent, etc. */
export interface IExpense {
  store: Types.ObjectId;
  title: string;
  category: ExpenseCategory;
  amount: number;
  incurredAt: Date;
  vendor?: string;
  /** Code of a user-managed PaymentMethod. */
  method: string;
  /** Set when the expense was generated from a purchase order. */
  order?: Types.ObjectId | null;
  receiptUrl?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseDocument = HydratedDocument<IExpense>;

const expenseSchema = new Schema<IExpense>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    category: {
      type: String,
      enum: EXPENSE_CATEGORY_VALUES,
      default: EXPENSE_CATEGORY.OTHER,
      index: true,
    },
    amount: { type: Number, required: true, min: [0, 'Amount cannot be negative'] },
    incurredAt: { type: Date, default: Date.now, index: true },
    vendor: { type: String, trim: true },
    method: { type: String, uppercase: true, trim: true, default: PAYMENT_METHOD.CARD },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    receiptUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

expenseSchema.index({ store: 1, incurredAt: -1 });

expenseSchema.plugin(tenantPlugin);

export const Expense: Model<IExpense> = model<IExpense>('Expense', expenseSchema);
export default Expense;
