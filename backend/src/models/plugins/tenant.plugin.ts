import type { MongooseQueryMiddleware, Query, Schema } from 'mongoose';
import { currentBusinessId, isUnscoped } from '../../lib/tenantContext';

/** Every query shape that can read or change documents. */
const QUERY_HOOKS: MongooseQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'distinct',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'replaceOne',
];

/**
 * Scopes a collection to one franchise.
 *
 * This is a B2B app: each business id is a separate customer, and one must
 * never see another's stores, items or orders. Rather than relying on every
 * service remembering to filter, the filter is injected here — so a query that
 * forgets is still scoped, and a new service is safe by default.
 *
 * Fail-closed: with no tenant on the context a query matches nothing, because
 * matching everything is exactly the leak this exists to prevent.
 */
export const tenantPlugin = (schema: Schema): void => {
  schema.add({
    businessId: { type: String, required: true, index: true },
  });

  schema.pre(QUERY_HOOKS, function (this: Query<unknown, unknown>) {
    if (isUnscoped()) return;
    const businessId = currentBusinessId();
    this.where({ businessId: businessId ?? '__no_tenant__' });
  });

  schema.pre('aggregate', function () {
    if (isUnscoped()) return;
    const businessId = currentBusinessId();
    this.pipeline().unshift({ $match: { businessId: businessId ?? '__no_tenant__' } });
  });

  // `validate`, not `save`: mongoose validates first, so stamping on save
  // would be too late and every insert would fail as "businessId is required".
  schema.pre('validate', function () {
    if (this.get('businessId')) return;
    const businessId = currentBusinessId();
    if (businessId) this.set('businessId', businessId);
  });

  // insertMany is not a query hook; its signature differs from the rest.
  schema.pre('insertMany', function (docs: unknown) {
    const businessId = currentBusinessId();
    if (!businessId || !Array.isArray(docs)) return;
    for (const doc of docs as Record<string, unknown>[]) {
      if (!doc.businessId) doc.businessId = businessId;
    }
  });
};

/**
 * Makes an index unique *within* a franchise rather than globally.
 * Two franchises both having a store coded "ALPHA" is normal, not a conflict.
 */
export const tenantUnique = (
  schema: Schema,
  fields: Record<string, 1>,
  options: Record<string, unknown> = {},
): void => {
  schema.index({ businessId: 1, ...fields }, { unique: true, ...options });
};
