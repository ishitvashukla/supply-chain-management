import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IPriceList {
  name: string;
  /** Id on the turns backend, which owns the catalog. */
  turnsPriceListId?: string | null;
  department: Types.ObjectId;
  /** Fallback price list when a store has none assigned. */
  isDefaultForStore: boolean;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PriceListDocument = HydratedDocument<IPriceList>;

const priceListSchema = new Schema<IPriceList>(
  {
    name: { type: String, required: [true, 'Price list name is required'], trim: true },
    turnsPriceListId: { type: String, default: null },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    isDefaultForStore: { type: Boolean, default: false },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

// A price list name only has to be unique inside its own department.
priceListSchema.index({ department: 1, name: 1 }, { unique: true });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
priceListSchema.index(
  { turnsPriceListId: 1 },
  { unique: true, partialFilterExpression: { turnsPriceListId: { $type: 'string' } } },
);

export const PriceList: Model<IPriceList> = model<IPriceList>('PriceList', priceListSchema);
export default PriceList;
