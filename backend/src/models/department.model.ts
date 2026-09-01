import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { tenantPlugin, tenantUnique } from './plugins/tenant.plugin';

export interface IDepartment {
  name: string;
  /** Id on the turns backend, which owns the catalog. */
  turnsDepartmentId?: string | null;
  code: string;
  description?: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type DepartmentDocument = HydratedDocument<IDepartment>;

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: [true, 'Department name is required'], trim: true },
    turnsDepartmentId: { type: String, default: null },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true } },
);

departmentSchema.index({ name: 1 });

// Unique only where a turns id exists. A plain sparse index would still
// treat every locally-created row's `null` as a duplicate.
tenantUnique(departmentSchema, { turnsDepartmentId: 1 }, {
  partialFilterExpression: { turnsDepartmentId: { $type: 'string' } },
});

tenantUnique(departmentSchema, { code: 1 });

departmentSchema.plugin(tenantPlugin);

export const Department: Model<IDepartment> = model<IDepartment>('Department', departmentSchema);
export default Department;
