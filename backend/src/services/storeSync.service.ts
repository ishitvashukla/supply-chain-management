import PriceList from '../models/priceList.model';
import Store from '../models/store.model';

/** A store as the turns `store_list` endpoint returns it. */
export interface TurnsStorePayload {
  store_id: string;
  store_name: string;
  short_name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  phone?: string;
  email?: string;
  default_price_list_id?: string;
  store_enable_disable?: string;
  show_hide?: string;
  order_prefix?: string;
}

/** Turns has no `code`; fall back through the fields that can stand in for one. */
const codeFor = (store: TurnsStorePayload): string =>
  (store.short_name?.trim() || store.order_prefix?.trim() || `ST${store.store_id}`)
    .toUpperCase()
    .slice(0, 24);

/**
 * Mirrors the turns store list into this app.
 *
 * Turns owns stores — they are not editable here — but orders, inventory and
 * expenses all reference a local Store document, so each turns store needs a
 * local counterpart. Matching is by `turnsStoreId`, so re-running is safe and
 * a renamed store updates rather than duplicating.
 */
export const syncStoresFromTurns = async (stores: TurnsStorePayload[]) => {
  let created = 0;
  let updated = 0;

  for (const incoming of stores) {
    const isActive =
      incoming.store_enable_disable !== 'disable' && incoming.show_hide !== 'hide';

    const fields = {
      name: incoming.store_name?.trim() || `Store ${incoming.store_id}`,
      code: codeFor(incoming),
      turnsStoreId: String(incoming.store_id),
      turnsPriceListId: incoming.default_price_list_id
        ? String(incoming.default_price_list_id)
        : null,
      phone: incoming.phone || undefined,
      email: incoming.email?.trim().toLowerCase() || undefined,
      address: {
        line1: incoming.address1 || undefined,
        line2: incoming.address2 || undefined,
        city: incoming.city || undefined,
        state: incoming.state || undefined,
        postalCode: incoming.zipcode || undefined,
      },
      isActive,
    };

    const existing = await Store.findOne({ turnsStoreId: String(incoming.store_id) });

    if (existing) {
      existing.set(fields);
      await existing.save({ validateBeforeSave: false });
      updated += 1;
    } else {
      // A locally-created store may already own this code; keep codes unique.
      const clash = await Store.findOne({ code: fields.code, turnsStoreId: null });
      if (clash) fields.code = `${fields.code}-${incoming.store_id}`.slice(0, 24);
      await Store.create(fields);
      created += 1;
    }
  }

  // Price lists may be synced after stores, so resolve the link afterwards.
  const linked = await linkStorePriceLists();

  return { created, updated, total: stores.length, priceListsLinked: linked };
};

/**
 * Points each store at its local PriceList, matched on the turns id it carries.
 * Without this the catalog tree falls back to a *global* default, and a store's
 * own items disappear from its order form.
 */
export const linkStorePriceLists = async (): Promise<number> => {
  const stores = await Store.find({ turnsPriceListId: { $ne: null }, priceList: null });
  let linked = 0;

  for (const store of stores) {
    const priceList = await PriceList.findOne({ turnsPriceListId: store.turnsPriceListId });
    if (!priceList) continue;
    store.priceList = priceList._id;
    await store.save({ validateBeforeSave: false });
    linked += 1;
  }

  return linked;
};

export default syncStoresFromTurns;
