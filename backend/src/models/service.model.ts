import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IService {
  name: string;
  /** Id on the turns backend, which owns the catalog. */
  turnsServiceId?: string | null;
  department: Types.ObjectId;
  /**
   * A service appears under more than one price list in turns, so this is a
   * list, not a single reference. Storing one would silently drop the others
   * on the next sync.
   */
  priceLists: Types.ObjectId[];
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ServiceDocument = HydratedDocument<IService>;

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: [true, 'Service name is required'], trim: true },
    turnsServiceId: { type: String, default: null },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    priceLists: [{ type: Schema.Types.ObjectId, ref: 'PriceList', index: true }],
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

serviceSchema.index({ name: 1, department: 1 });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
serviceSchema.index(
  { turnsServiceId: 1 },
  { unique: true, partialFilterExpression: { turnsServiceId: { $type: 'string' } } },
);

export const Service: Model<IService> = model<IService>('Service', serviceSchema);
export default Service;
