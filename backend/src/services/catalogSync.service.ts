import Category from '../models/category.model';
import Department from '../models/department.model';
import PriceList from '../models/priceList.model';
import Service from '../models/service.model';
import Store from '../models/store.model';
import { linkStorePriceLists } from './storeSync.service';
import ApiError from '../utils/ApiError';

/* -------------------------------------------------- turns payload shapes */

export interface TurnsProduct {
  product_id: string;
  product_name: string;
  product_code?: string;
  product_image?: string;
  price?: string | number;
  min_price?: string | number;
  min_item?: string | number;
  piece?: string;
  service_unit?: string;
  short_code?: string;
  online?: string;
}

export interface TurnsCategory {
  cat_id: string;
  cat_name: string;
  cat_desc?: string;
  products?: TurnsProduct[];
}

export interface TurnsService {
  service_id: string;
  service_name: string;
  service_unit?: string;
  service_code?: string;
  department_id: string;
  department_name: string;
  categories?: TurnsCategory[];
  /** Products filed straight under the service, with no category. */
  products?: TurnsProduct[];
}

export interface TurnsPriceList {
  price_list_id: string;
  price_list_name: string;
  is_default_for_store?: boolean;
  is_default_for_customer?: boolean;
  services?: TurnsService[];
}

const slugCode = (value: string, fallback: string): string =>
  (value?.trim() || fallback).toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').slice(0, 32);

/**
 * Mirrors the turns **classification** into this app: Department → PriceList →
 * Service → Category, for one store.
 *
 * Deliberately does NOT import the products in that response. Those are the
 * laundry service catalog used by the main app (Wash & Fold, garments); this
 * app tracks materials, which users add here. Turns only supplies the lists a
 * material is classified against.
 */
export const syncCatalogFromTurns = async (
  priceLists: TurnsPriceList[],
  turnsStoreId?: string,
) => {
  // Sets, not counters: the same service appears under more than one price
  // list, so incrementing per upsert would over-report what was actually synced.
  const seen = {
    departments: new Set<string>(),
    priceLists: new Set<string>(),
    services: new Set<string>(),
    categories: new Set<string>(),
  };

  // The lists are store-scoped, so the store must already exist locally.
  if (turnsStoreId) {
    const store = await Store.findOne({ turnsStoreId: String(turnsStoreId) });
    if (!store) {
      throw ApiError.notFound(`Store ${turnsStoreId} has not been synced yet — sync stores first`);
    }
  }

  const departmentCache = new Map<string, string>();

  const upsertDepartment = async (id: string, name: string): Promise<string> => {
    const cached = departmentCache.get(id);
    if (cached) return cached;

    const existing = await Department.findOneAndUpdate(
      { turnsDepartmentId: String(id) },
      {
        $set: { name: name?.trim() || `Department ${id}` },
        $setOnInsert: { turnsDepartmentId: String(id), code: slugCode(name, `DEPT-${id}`) },
      },
      { returnDocument: 'after', upsert: true },
    );

    seen.departments.add(String(id));
    departmentCache.set(id, String(existing!.id));
    return String(existing!.id);
  };

  for (const list of priceLists) {
    // A price list needs a department; take it from its first service.
    const firstService = list.services?.[0];
    const departmentId = firstService
      ? await upsertDepartment(firstService.department_id, firstService.department_name)
      : await upsertDepartment('0', 'General');

    const priceList = await PriceList.findOneAndUpdate(
      { turnsPriceListId: String(list.price_list_id) },
      {
        $set: {
          name: list.price_list_name?.trim() || `Price list ${list.price_list_id}`,
          department: departmentId,
          isDefaultForStore: Boolean(list.is_default_for_store),
        },
        $setOnInsert: { turnsPriceListId: String(list.price_list_id) },
      },
      { returnDocument: 'after', upsert: true },
    );
    seen.priceLists.add(String(list.price_list_id));

    for (const svc of list.services ?? []) {
      const svcDepartmentId = await upsertDepartment(svc.department_id, svc.department_name);

      const service = await Service.findOneAndUpdate(
        { turnsServiceId: String(svc.service_id) },
        {
          $set: {
            name: svc.service_name?.trim() || `Service ${svc.service_id}`,
            department: svcDepartmentId,
          },
          // addToSet, not set: syncing another price list must not drop the
          // ones this service already belongs to.
          $addToSet: { priceLists: priceList!._id },
          $setOnInsert: { turnsServiceId: String(svc.service_id) },
        },
        { returnDocument: 'after', upsert: true },
      );
      seen.services.add(String(svc.service_id));

      for (const cat of svc.categories ?? []) {
        await Category.findOneAndUpdate(
          { turnsCategoryId: String(cat.cat_id) },
          {
            $set: {
              name: cat.cat_name?.trim() || `Category ${cat.cat_id}`,
              description: cat.cat_desc || undefined,
              service: service!._id,
            },
            $setOnInsert: { turnsCategoryId: String(cat.cat_id) },
          },
          { returnDocument: 'after', upsert: true },
        );
        seen.categories.add(String(cat.cat_id));

      }
    }
  }

  // Price lists now exist locally, so stores that were waiting on them can be
  // pointed at theirs.
  await linkStorePriceLists();

  return {
    departments: seen.departments.size,
    priceLists: seen.priceLists.size,
    services: seen.services.size,
    categories: seen.categories.size,
  };
};

export default syncCatalogFromTurns;
