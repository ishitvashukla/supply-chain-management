import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { tenantPlugin, tenantUnique } from './plugins/tenant.plugin';

/**
 * User-managed payment methods.
 *
 * Replaces the fixed enum: businesses settle in ways we can't enumerate up
 * front (a specific bank, a wallet, store credit). Payments store the method's
 * *code*, so renaming a method never rewrites payment history.
 */
export interface IPaymentMethod {
  name: string;
  /** Stable identifier written onto payments. Immutable once created. */
  code: string;
  description?: string;
  /** Offered first in pickers. */
  sortOrder: number;
  isActive: boolean;
  /** Built-in methods cannot be deleted, only deactivated. */
  isSystem: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentMethodDocument = HydratedDocument<IPaymentMethod>;

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

paymentMethodSchema.index({ sortOrder: 1, name: 1 });

tenantUnique(paymentMethodSchema, { code: 1 });

paymentMethodSchema.plugin(tenantPlugin);

export const PaymentMethodModel: Model<IPaymentMethod> = model<IPaymentMethod>(
  'PaymentMethod',
  paymentMethodSchema,
);
export default PaymentMethodModel;
