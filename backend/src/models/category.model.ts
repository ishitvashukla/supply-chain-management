import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

/**
 * Optional level: a service may hold products directly, with no category.
 * Mirrors `categories?` / `products?` on ServiceTypes in the customer app.
 */
export interface ICategory {
  name: string;
  /** Id on the turns backend, which owns the catalog. */
  turnsCategoryId?: string | null;
  service: Types.ObjectId;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    turnsCategoryId: { type: String, default: null },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

categorySchema.index({ service: 1, name: 1 }, { unique: true });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
categorySchema.index(
  { turnsCategoryId: 1 },
  { unique: true, partialFilterExpression: { turnsCategoryId: { $type: 'string' } } },
);

export const Category: Model<ICategory> = model<ICategory>('Category', categorySchema);
export default Category;
