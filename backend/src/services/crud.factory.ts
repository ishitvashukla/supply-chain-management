import type { Model, QueryFilter, PopulateOptions } from 'mongoose';
import ApiError from '../utils/ApiError';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  filter?: Record<string, unknown>;
}

export interface CrudOptions {
  /** Fields a `search` term is matched against, case-insensitively. */
  searchFields?: string[];
  populate?: (string | PopulateOptions)[];
  defaultSort?: string;
  label?: string;
}

/**
 * Shared CRUD for the catalog levels, which differ only by schema.
 * Anything with real business rules (orders, payments, stock) has its own
 * service instead of being forced through this.
 */
export const createCrudService = <T>(model: Model<T>, options: CrudOptions = {}) => {
  const {
    searchFields = ['name'],
    populate = [],
    defaultSort = '-createdAt',
    label = model.modelName,
  } = options;

  const applyPopulate = <Q extends { populate: (arg: never) => Q }>(query: Q): Q => {
    populate.forEach((path) => query.populate(path as never));
    return query;
  };

  return {
    async list({ page = 1, limit = 20, search, sort, filter = {} }: ListParams = {}) {
      const query: QueryFilter<T> = { ...filter } as QueryFilter<T>;

      if (search && searchFields.length) {
        Object.assign(query, {
          $or: searchFields.map((field) => ({ [field]: new RegExp(search, 'i') })),
        });
      }

      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        applyPopulate(model.find(query).sort(sort ?? defaultSort).skip(skip).limit(limit)),
        model.countDocuments(query),
      ]);

      return {
        items,
        meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      };
    },

    async getById(id: string) {
      const doc = await applyPopulate(model.findById(id));
      if (!doc) throw ApiError.notFound(`${label} not found`);
      return doc;
    },

    async create(payload: Partial<T>) {
      return model.create(payload);
    },

    async update(id: string, payload: Partial<T>) {
      const doc = await model.findByIdAndUpdate(id, payload, { returnDocument: 'after', runValidators: true });
      if (!doc) throw ApiError.notFound(`${label} not found`);
      return doc;
    },

    async remove(id: string) {
      const doc = await model.findByIdAndDelete(id);
      if (!doc) throw ApiError.notFound(`${label} not found`);
      return doc;
    },
  };
};

export type CrudService<T> = ReturnType<typeof createCrudService<T>>;
