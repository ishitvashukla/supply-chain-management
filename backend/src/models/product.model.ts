import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { tenantPlugin, tenantUnique } from './plugins/tenant.plugin';

export interface ITax {
  name: string;
  percentage: number;
  applicableOn?: string;
}

/**
 * The master item. Global definition + default price; per-store price and
 * availability live on StoreItem so one catalog can serve every location.
 */
export interface IProduct {
  name: string;
  /** Id on the turns backend, which owns the catalog. */
  turnsProductId?: string | null;
  code: string;
  shortCode?: string;
  description?: string;
  /** A base64 data URL when uploaded here, or an http link when it came from turns. */
  image?: string;
  department: Types.ObjectId;
  priceList: Types.ObjectId;
  service: Types.ObjectId;
  /** Null when the product hangs directly off the service. */
  category?: Types.ObjectId | null;
  basePrice: number;
  /**
   * Pack size and unit together describe how the material is bought:
   * `packSize: 5, unit: 'L'` is a 5 L container. Price and stock are counted
   * in packs, not in the raw unit.
   */
  packSize: number;
  unit: string;
  piece?: string;
  minPrice?: number;
  minItem?: number;
  taxes: ITax[];
  /** Default reorder points; a store may override them on its StoreItem. */
  defaultReorderThreshold: number;
  defaultCriticalThreshold: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<IProduct>;

const taxSchema = new Schema<ITax>(
  {
    name: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    applicableOn: { type: String, trim: true },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    turnsProductId: { type: String, default: null },
    code: { type: String, required: true, trim: true, uppercase: true },
    shortCode: { type: String, trim: true },
    description: { type: String, trim: true },
    // select:false — an inline image would bloat every list query.
    image: { type: String, select: false },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    priceList: { type: Schema.Types.ObjectId, ref: 'PriceList', required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    basePrice: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    packSize: { type: Number, default: 1, min: [0, 'Pack size cannot be negative'] },
    unit: { type: String, required: true, trim: true, default: 'unit' },
    piece: { type: String, trim: true },
    minPrice: { type: Number, min: 0 },
    minItem: { type: Number, min: 0 },
    taxes: { type: [taxSchema], default: [] },
    defaultReorderThreshold: { type: Number, default: 0, min: 0 },
    defaultCriticalThreshold: { type: Number, default: 0, min: 0 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

productSchema.index({ name: 'text', code: 'text', description: 'text' });
productSchema.index({ service: 1, category: 1, sortOrder: 1 });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
tenantUnique(productSchema, { turnsProductId: 1 }, {
  partialFilterExpression: { turnsProductId: { $type: 'string' } },
});

tenantUnique(productSchema, { code: 1 });

productSchema.plugin(tenantPlugin);

export const Product: Model<IProduct> = model<IProduct>('Product', productSchema);
export default Product;
