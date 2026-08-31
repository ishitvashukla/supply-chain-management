import turnsApi from './turnsClient';
import { TURNS } from './turnsEndpoints';

/** One store exactly as the turns `store_list` endpoint returns it. */
export interface TurnsStore {
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
  store_logo?: string;
  order_prefix?: string;
  default_price_list_id?: string;
  store_enable_disable?: string;
  show_hide?: string;
}

/**
 * Turns is the source of truth for stores — they are managed there, not here.
 * Disabled and hidden stores are filtered out so they never reach a picker.
 */
export const fetchTurnsStores = async (): Promise<TurnsStore[]> => {
  const response = await turnsApi.post<TurnsStore[]>(TURNS.STORE_LIST, {});
  if (!response.status) throw new Error(response.message ?? 'Could not load stores');

  return (response.data ?? [])
    .filter((store) => store.store_enable_disable !== 'disable' && store.show_hide !== 'hide')
    .sort((a, b) => (a.store_name ?? '').localeCompare(b.store_name ?? ''));
};

/* --------------------------------- per-store classification (live) ------- */

export interface TurnsTreeCategory {
  cat_id: string;
  cat_name: string;
  cat_desc?: string;
}

export interface TurnsTreeService {
  service_id: string;
  service_name: string;
  department_id: string;
  department_name: string;
  categories?: TurnsTreeCategory[];
}

export interface TurnsTreePriceList {
  price_list_id: string;
  price_list_name: string;
  is_default_for_store?: boolean;
  services?: TurnsTreeService[];
}

/**
 * The price lists — and the services and categories under them — that apply to
 * one store. This is the live source for the item form's cascade.
 *
 * The response also carries the laundry service catalog's products; those are a
 * different domain from the materials this app tracks, so they are ignored.
 */
export const fetchTurnsPriceLists = async (
  turnsStoreId: string,
): Promise<TurnsTreePriceList[]> => {
  const response = await turnsApi.post<{ price_list?: TurnsTreePriceList[] }>(
    TURNS.PRICE_LIST,
    { store_id: turnsStoreId },
  );
  if (!response.status) throw new Error(response.message ?? 'Could not load price lists');
  return response.data?.price_list ?? [];
};
