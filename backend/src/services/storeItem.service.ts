import Product from '../models/product.model';
import Store from '../models/store.model';
import StoreItem, { type IStoreItem } from '../models/storeItem.model';
import ApiError from '../utils/ApiError';
import { STOCK_HEALTH } from '../constants';

export interface StoreItemFilters {
  page?: number;
  limit?: number;
  search?: string;
  /** Filter to a computed stock band rather than a raw quantity. */
  health?: 'OK' | 'LOW' | 'CRITICAL' | 'OUT';
  isAvailable?: boolean;
}

const populateProduct = [
  { path: 'product', select: 'name code image unit basePrice category service' },
] as const;

/** The per-location item list: one row per store/product pair. */
export const storeItemService = {
  async list(storeId: string, { page = 1, limit = 20, search, health, isAvailable }: StoreItemFilters = {}) {
    const filter: Record<string, unknown> = { store: storeId };
    if (typeof isAvailable === 'boolean') filter.isAvailable = isAvailable;

    if (search) {
      const products = await Product.find({
        $or: [{ name: new RegExp(search, 'i') }, { code: new RegExp(search, 'i') }],
      }).select('_id');
      filter.product = { $in: products.map((p) => p._id) };
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      StoreItem.find(filter).populate(populateProduct as never).sort('-updatedAt').skip(skip).limit(limit),
      StoreItem.countDocuments(filter),
    ]);

    // stockHealth is a virtual, so band filtering happens after hydration.
    const items = health ? rows.filter((row) => row.get('stockHealth') === health) : rows;

    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
  },

  async getById(id: string) {
    const item = await StoreItem.findById(id).populate(populateProduct as never);
    if (!item) throw ApiError.notFound('Store item not found');
    return item;
  },

  async getForStoreProduct(storeId: string, productId: string) {
    return StoreItem.findOne({ store: storeId, product: productId });
  },

  async create(storeId: string, payload: Partial<IStoreItem>) {
    const [store, product] = await Promise.all([
      Store.findById(storeId),
      Product.findById(payload.product),
    ]);
    if (!store) throw ApiError.notFound('Store not found');
    if (!product) throw ApiError.notFound('Product not found');

    const existing = await StoreItem.findOne({ store: storeId, product: payload.product });
    if (existing) throw ApiError.conflict('This store already stocks that product');

    return StoreItem.create({
      // Inherit the product's reorder points unless the store overrides them.
      reorderThreshold: product.defaultReorderThreshold,
      criticalThreshold: product.defaultCriticalThreshold,
      ...payload,
      store: storeId,
    });
  },

  async update(id: string, payload: Partial<IStoreItem>) {
    // Stock is only ever moved through the stock service, never patched directly.
    const { quantityOnHand: _ignored, store: _store, product: _product, ...safe } = payload;
    const item = await StoreItem.findByIdAndUpdate(id, safe, { returnDocument: 'after', runValidators: true });
    if (!item) throw ApiError.notFound('Store item not found');
    return item;
  },

  async remove(id: string) {
    const item = await StoreItem.findByIdAndDelete(id);
    if (!item) throw ApiError.notFound('Store item not found');
    return item;
  },

  /** Adds every active product a store doesn't stock yet, in one call. */
  async syncCatalog(storeId: string) {
    const store = await Store.findById(storeId);
    if (!store) throw ApiError.notFound('Store not found');

    const [products, existing] = await Promise.all([
      Product.find({ isActive: true }),
      StoreItem.find({ store: storeId }).select('product'),
    ]);

    const have = new Set(existing.map((item) => String(item.product)));
    const missing = products.filter((product) => !have.has(String(product.id)));

    if (!missing.length) return { added: 0 };

    await StoreItem.insertMany(
      missing.map((product) => ({
        store: storeId,
        product: product.id,
        reorderThreshold: product.defaultReorderThreshold,
        criticalThreshold: product.defaultCriticalThreshold,
      })),
    );

    return { added: missing.length };
  },

  /** Items at or below their reorder point — drives alerts and the dashboard. */
  async lowStock(storeId?: string) {
    const filter: Record<string, unknown> = storeId ? { store: storeId } : {};
    const rows = await StoreItem.find(filter)
      .populate(populateProduct as never)
      .populate('store', 'name code');

    return rows
      .filter((row) => row.get('stockHealth') !== STOCK_HEALTH.OK)
      .sort((a, b) => a.quantityOnHand - b.quantityOnHand);
  },
};

export default storeItemService;
