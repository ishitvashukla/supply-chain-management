import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { STOCK_MOVEMENT_VALUES, type StockMovement } from '../constants';

/**
 * Append-only ledger of every stock change. StoreItem.quantityOnHand is the
 * running total; this is the audit trail behind it and the source for usage
 * analytics.
 */
export interface IStockMovement {
  store: Types.ObjectId;
  product: Types.ObjectId;
  type: StockMovement;
  /** Always positive; direction is implied by `type`. */
  quantity: number;
  /** Signed delta actually applied to stock on hand. */
  delta: number;
  balanceAfter: number;
  order?: Types.ObjectId | null;
  performedBy: Types.ObjectId;
  note?: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type StockMovementDocument = HydratedDocument<IStockMovement>;

const stockMovementSchema = new Schema<IStockMovement>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: STOCK_MOVEMENT_VALUES, required: true, index: true },
    quantity: { type: Number, required: true, min: [0.0001, 'Quantity must be greater than zero'] },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

stockMovementSchema.index({ store: 1, product: 1, occurredAt: -1 });

export const StockMovementModel: Model<IStockMovement> = model<IStockMovement>(
  'StockMovement',
  stockMovementSchema,
);
export default StockMovementModel;
