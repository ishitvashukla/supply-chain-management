import Category from '../models/category.model';
import Product, { type IProduct } from '../models/product.model';
import Service from '../models/service.model';
import StoreItem from '../models/storeItem.model';
import ApiError from '../utils/ApiError';
import { createCrudService, type ListParams } from './crud.factory';

const base = createCrudService(Product, {
  searchFields: ['name', 'code', 'shortCode'],
  populate: [
    { path: 'department', select: 'name code' },
    { path: 'priceList', select: 'name' },
    { path: 'service', select: 'name' },
    { path: 'category', select: 'name' },
  ],
  defaultSort: 'sortOrder name',
  label: 'Product',
});

export interface ProductFilters extends ListParams {
  department?: string;
  priceList?: string;
  service?: string;
  category?: string;
  isActive?: boolean;
}

/** A category must belong to the service the product is being filed under. */
const assertHierarchy = async (payload: Partial<IProduct>) => {
  if (!payload.service) return;
  const service = await Service.findById(payload.service);
  if (!service) throw ApiError.notFound('Service not found');

  if (payload.category) {
    const category = await Category.findById(payload.category);
    if (!category) throw ApiError.notFound('Category not found');
    if (String(category.service) !== String(service.id)) {
      throw ApiError.badRequest('Category does not belong to the selected service');
    }
  }

  // The form picks the price list explicitly (a service belongs to several),
  // so only fall back to the service's first when none was given.
  if (payload.priceList) {
    const belongs = (service.priceLists ?? []).some(
      (id) => String(id) === String(payload.priceList),
    );
    if (!belongs) {
      throw ApiError.badRequest('Service does not belong to the selected price list');
    }
  } else {
    payload.priceList = service.priceLists?.[0];
  }

  payload.department = service.department;
};

export const productService = {
  ...base,

  /** The image is excluded from lists, so fetch it explicitly here. */
  async getById(id: string) {
    const product = await Product.findById(id).select('+image');
    if (!product) throw ApiError.notFound('Item not found');
    return product;
  },

  /**
   * Adds the item to a store's list as part of creating it.
   *
   * The catalog itself stays shared — two stores stocking the same material
   * must not create two items — so the store link lives on StoreItem, which is
   * also where that store's own price and reorder points are kept.
   */
  async addToStore(productId: string, storeId: string, price?: number | null) {
    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Item not found');

    const existing = await StoreItem.findOne({ store: storeId, product: productId });
    if (existing) return existing;

    return StoreItem.create({
      store: storeId,
      product: productId,
      price: price ?? null,
      reorderThreshold: product.defaultReorderThreshold,
      criticalThreshold: product.defaultCriticalThreshold,
    });
  },

  list({ department, priceList, service, category, isActive, ...params }: ProductFilters = {}) {
    const filter: Record<string, unknown> = {};
    if (department) filter.department = department;
    if (priceList) filter.priceList = priceList;
    if (service) filter.service = service;
    if (category) filter.category = category === 'none' ? null : category;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    return base.list({ ...params, filter });
  },

  async create(payload: Partial<IProduct>) {
    await assertHierarchy(payload);
    return base.create(payload);
  },

  async update(id: string, payload: Partial<IProduct>) {
    await assertHierarchy(payload);
    return base.update(id, payload);
  },

  /** Deleting a product that stores still stock would orphan their rows. */
  async remove(id: string) {
    const linked = await StoreItem.countDocuments({ product: id });
    if (linked > 0) {
      throw ApiError.conflict(
        `Product is stocked by ${linked} store(s); deactivate it instead of deleting`,
      );
    }
    return base.remove(id);
  },
};

export default productService;
