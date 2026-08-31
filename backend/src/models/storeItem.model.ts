import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { STOCK_HEALTH, type StockHealth } from '../constants';

/**
 * The per-location item record — this is what makes "the item list different
 * for each store" while the catalog above it stays shared. It carries the
 * store's price override, whether it stocks the item at all, its own reorder
 * points, and its current quantity on hand.
 */
export interface IStoreItem {
  store: Types.ObjectId;
  product: Types.ObjectId;
  /** Overrides Product.basePrice for this store when set. */
  price?: number | null;
  isAvailable: boolean;
  quantityOnHand: number;
  reorderThreshold: number;
  criticalThreshold: number;
  /** Rolling average used by the reorder forecast. */
  avgDailyUsage: number;
  lastRestockedAt?: Date | null;
  lastCountedAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Virtual */
  stockHealth?: StockHealth;
}

export type StoreItemDocument = HydratedDocument<IStoreItem>;

const storeItemSchema = new Schema<IStoreItem>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    price: { type: Number, default: null, min: [0, 'Price cannot be negative'] },
    isAvailable: { type: Boolean, default: true },
    quantityOnHand: { type: Number, default: 0, min: [0, 'Quantity cannot be negative'] },
    reorderThreshold: { type: Number, default: 0, min: 0 },
    criticalThreshold: { type: Number, default: 0, min: 0 },
    avgDailyUsage: { type: Number, default: 0, min: 0 },
    lastRestockedAt: { type: Date, default: null },
    lastCountedAt: { type: Date, default: null },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// One row per store/product pair.
storeItemSchema.index({ store: 1, product: 1 }, { unique: true });
storeItemSchema.index({ store: 1, quantityOnHand: 1 });

/** Derived severity used by dashboards and alerts. */
storeItemSchema.virtual('stockHealth').get(function (this: IStoreItem): StockHealth {
  if (this.quantityOnHand <= 0) return STOCK_HEALTH.OUT;
  if (this.criticalThreshold > 0 && this.quantityOnHand <= this.criticalThreshold) {
    return STOCK_HEALTH.CRITICAL;
  }
  if (this.reorderThreshold > 0 && this.quantityOnHand <= this.reorderThreshold) {
    return STOCK_HEALTH.LOW;
  }
  return STOCK_HEALTH.OK;
});

/** Days of cover left at the current burn rate; null when usage is unknown. */
storeItemSchema.virtual('daysOfCover').get(function (this: IStoreItem): number | null {
  if (!this.avgDailyUsage || this.avgDailyUsage <= 0) return null;
  return Math.floor(this.quantityOnHand / this.avgDailyUsage);
});

export const StoreItem: Model<IStoreItem> = model<IStoreItem>('StoreItem', storeItemSchema);
export default StoreItem;
