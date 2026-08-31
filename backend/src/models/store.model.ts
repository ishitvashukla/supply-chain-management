import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IStoreAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface IStore {
  name: string;
  code: string;
  /** `store_id` on the turns backend — the source of truth for stores. */
  turnsStoreId?: string | null;
  /** turns `default_price_list_id`, resolved to a local PriceList when synced. */
  turnsPriceListId?: string | null;
  address: IStoreAddress;
  phone?: string;
  email?: string;
  manager?: Types.ObjectId;
  /** Price list this location buys against; falls back to the default one. */
  priceList?: Types.ObjectId | null;
  timezone: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StoreDocument = HydratedDocument<IStore>;

const addressSchema = new Schema<IStoreAddress>(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'US' },
  },
  { _id: false },
);

const storeSchema = new Schema<IStore>(
  {
    name: { type: String, required: [true, 'Store name is required'], trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    turnsStoreId: { type: String, default: null },
    turnsPriceListId: { type: String, default: null },
    address: { type: addressSchema, default: {} },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },
    priceList: { type: Schema.Types.ObjectId, ref: 'PriceList', default: null },
    timezone: { type: String, default: 'America/Chicago' },
    currency: { type: String, default: 'USD' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

storeSchema.index({ name: 'text', code: 'text' });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
storeSchema.index(
  { turnsStoreId: 1 },
  { unique: true, partialFilterExpression: { turnsStoreId: { $type: 'string' } } },
);

export const Store: Model<IStore> = model<IStore>('Store', storeSchema);
export default Store;
