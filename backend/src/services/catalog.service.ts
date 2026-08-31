import Category from '../models/category.model';
import Department from '../models/department.model';
import PriceList from '../models/priceList.model';
import Product from '../models/product.model';
import Service from '../models/service.model';
import Store from '../models/store.model';
import StoreItem from '../models/storeItem.model';
import ApiError from '../utils/ApiError';
import { createCrudService } from './crud.factory';

export const departmentService = createCrudService(Department, {
  searchFields: ['name', 'code'],
  defaultSort: 'name',
  label: 'Department',
});

export const priceListService = createCrudService(PriceList, {
  searchFields: ['name'],
  populate: [{ path: 'department', select: 'name code' }],
  defaultSort: 'name',
  label: 'Price list',
});

export const serviceService = createCrudService(Service, {
  searchFields: ['name'],
  populate: [
    { path: 'department', select: 'name code' },
    { path: 'priceLists', select: 'name' },
  ],
  defaultSort: 'sortOrder name',
  label: 'Service',
});

export const categoryService = createCrudService(Category, {
  searchFields: ['name'],
  populate: [{ path: 'service', select: 'name' }],
  defaultSort: 'sortOrder name',
  label: 'Category',
});

/** Products nested under a category, or hanging directly off the service. */
interface TreeProduct {
  id: string;
  name: string;
  code: string;
  image?: string;
  basePrice: number;
  price: number;
  packSize: number;
  unit: string;
  taxes: unknown;
  /** Present only when the tree was built for a specific store. */
  storeItem?: {
    id: string;
    isAvailable: boolean;
    quantityOnHand: number;
    reorderThreshold: number;
    criticalThreshold: number;
    stockHealth: string;
  } | null;
}

/**
 * Builds Department → PriceList → Service → Category? → Product in one pass.
 * When `storeId` is given, each product carries that store's price override
 * and stock, which is what makes the same catalog render differently per location.
 */
export const buildCatalogTree = async (opts: { storeId?: string; priceListId?: string } = {}) => {
  const { storeId, priceListId } = opts;

  let resolvedPriceList = priceListId;

  if (storeId) {
    const store = await Store.findById(storeId);
    if (!store) throw ApiError.notFound('Store not found');
    if (!resolvedPriceList) {
      // The store's own list first. `isDefaultForStore` is a per-store flag on
      // the turns side, so as a global fallback it is only a last resort.
      resolvedPriceList = store.priceList ? String(store.priceList) : undefined;

      if (!resolvedPriceList && store.turnsPriceListId) {
        const byTurnsId = await PriceList.findOne({ turnsPriceListId: store.turnsPriceListId });
        resolvedPriceList = byTurnsId ? String(byTurnsId.id) : undefined;
      }

      if (!resolvedPriceList) {
        const fallback = await PriceList.findOne({ isDefaultForStore: true, isActive: true });
        resolvedPriceList = fallback ? String(fallback.id) : undefined;
      }
    }
  }

  const priceListFilter = resolvedPriceList ? { _id: resolvedPriceList } : { isActive: true };

  const [priceLists, services, categories, products, storeItems] = await Promise.all([
    PriceList.find(priceListFilter).populate('department', 'name code').sort('name'),
    Service.find({ isActive: true }).sort('sortOrder name'),
    Category.find({ isActive: true }).sort('sortOrder name'),
    Product.find({ isActive: true }).sort('sortOrder name'),
    storeId ? StoreItem.find({ store: storeId }) : Promise.resolve([]),
  ]);

  const itemByProduct = new Map(storeItems.map((item) => [String(item.product), item]));

  const mapProduct = (product: (typeof products)[number]): TreeProduct => {
    const storeItem = itemByProduct.get(String(product.id));
    return {
      id: String(product.id),
      name: product.name,
      code: product.code,
      image: product.image,
      basePrice: product.basePrice,
      // Store override wins; otherwise the catalog price stands.
      price: storeItem?.price ?? product.basePrice,
      packSize: product.packSize,
      unit: product.unit,
      taxes: product.taxes,
      storeItem: storeId
        ? storeItem
          ? {
              id: String(storeItem.id),
              isAvailable: storeItem.isAvailable,
              quantityOnHand: storeItem.quantityOnHand,
              reorderThreshold: storeItem.reorderThreshold,
              criticalThreshold: storeItem.criticalThreshold,
              stockHealth: String(storeItem.get('stockHealth')),
            }
          : null
        : undefined,
    };
  };

  const productsByService = new Map<string, typeof products>();
  const productsByCategory = new Map<string, typeof products>();

  products.forEach((product) => {
    if (product.category) {
      const key = String(product.category);
      productsByCategory.set(key, [...(productsByCategory.get(key) ?? []), product]);
    } else {
      const key = String(product.service);
      productsByService.set(key, [...(productsByService.get(key) ?? []), product]);
    }
  });

  const categoriesByService = new Map<string, typeof categories>();
  categories.forEach((category) => {
    const key = String(category.service);
    categoriesByService.set(key, [...(categoriesByService.get(key) ?? []), category]);
  });

  return priceLists.map((priceList) => ({
    priceListId: String(priceList.id),
    priceListName: priceList.name,
    isDefaultForStore: priceList.isDefaultForStore,
    department: priceList.department,
    services: services
      // Membership, not equality: a service sits under several price lists.
      .filter((service) =>
        (service.priceLists ?? []).some((id) => String(id) === String(priceList.id)),
      )
      .map((service) => ({
        serviceId: String(service.id),
        serviceName: service.name,
        categories: (categoriesByService.get(String(service.id)) ?? []).map((category) => ({
          categoryId: String(category.id),
          categoryName: category.name,
          description: category.description,
          products: (productsByCategory.get(String(category.id)) ?? []).map(mapProduct),
        })),
        // Uncategorised products live here — the "sometimes no category" case.
        products: (productsByService.get(String(service.id)) ?? []).map(mapProduct),
      })),
  }));
};
