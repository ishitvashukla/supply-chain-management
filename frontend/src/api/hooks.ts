import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { ApiError } from './client';
import {
  fetchTurnsPriceLists,
  fetchTurnsStores,
  type TurnsStore,
  type TurnsTreePriceList,
} from './turnsStores';
import { qk } from './queryKeys';
import type {
  ApiEnvelope,
  Category,
  Department,
  Order,
  OrderStatus,
  PageMeta,
  Payment,
  PriceList,
  Product,
  ReorderRow,
  Service,
  StatsOverview,
  StockMovement,
  Store,
  StoreItem,
  TreePriceList,
} from '@/types';

type Params = Record<string, unknown> | undefined;

const clean = (params: Params) => {
  if (!params) return undefined;
  // Drop empty values so they don't become `?search=` and fail validation.
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  );
};

const listQuery = <T>(url: string, key: readonly unknown[], params?: Params) => ({
  queryKey: key,
  queryFn: () => api.get<T[]>(url, { params: clean(params) }),
});

export const useApiError = () => (error: unknown) => {
  const message = error instanceof ApiError ? error.message : 'Something went wrong';
  toast.error(message);
};

/** Wraps a mutation with a toast + cache invalidation, which every form wants. */
const useApiMutation = <TVars, TData>(
  fn: (vars: TVars) => Promise<ApiEnvelope<TData>>,
  options: { success?: string; invalidate?: readonly unknown[][] } = {},
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      if (options.success !== '') toast.success(options.success ?? res.message);
      options.invalidate?.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    },
  });
};

/* ------------------------------------------------------------------ stats */

export const useOverview = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('overview', params),
    queryFn: () => api.get<StatsOverview>('/stats/overview', { params: clean(params) }),
  });

export const useOrderTrend = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('order-trend', params),
    queryFn: () =>
      api.get<{ date: string; orders: number; value: number }[]>('/stats/order-trend', {
        params: clean(params),
      }),
  });

export const useOrdersByStatus = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('orders-by-status', params),
    queryFn: () =>
      api.get<{ status: OrderStatus; count: number; value: number }[]>('/stats/orders-by-status', {
        params: clean(params),
      }),
  });

export const useTopConsumed = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('top-consumed', params),
    queryFn: () =>
      api.get<{ name: string; code: string; consumed: number; unit: string }[]>(
        '/stats/top-consumed',
        { params: clean(params) },
      ),
  });

export const useReorderForecast = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('reorder-forecast', params),
    queryFn: () => api.get<ReorderRow[]>('/stats/reorder-forecast', { params: clean(params) }),
  });

export const useFinancials = (params?: Params) =>
  useQuery({
    queryKey: qk.stats('financials', params),
    queryFn: () =>
      api.get<{ windowDays: number; inventoryValue: number; expenses: number; ordersPaid: number }>(
        '/stats/financials',
        { params: clean(params) },
      ),
  });

/* ----------------------------------------------------------------- stores */

/**
 * The store list straight from turns, which owns stores.
 * Cached longer than most queries because it changes rarely.
 */
export const useTurnsStores = () =>
  useQuery({
    queryKey: ['turns-stores'],
    queryFn: fetchTurnsStores,
    staleTime: 5 * 60_000,
  });

/**
 * Mirrors the turns list into this app so orders and inventory have a local
 * store to reference. Returns the local records.
 */
export const useSyncStoresFromTurns = () =>
  useApiMutation<TurnsStore[], { created: number; updated: number; total: number }>(
    (stores) => api.post('/stores/sync-from-turns', { stores }),
    { success: '', invalidate: [['stores'], ['turns-stores']] },
  );

/** Price lists (with services and categories) for one store, live from turns. */
export const useTurnsPriceLists = (turnsStoreId?: string | null) =>
  useQuery({
    queryKey: ['turns-price-lists', turnsStoreId],
    queryFn: () => fetchTurnsPriceLists(turnsStoreId as string),
    enabled: Boolean(turnsStoreId),
    staleTime: 5 * 60_000,
  });

/** Mirrors a store's classification locally so items can reference it. */
export const useSyncCatalogFromTurns = () =>
  useApiMutation<
    { turnsStoreId: string; priceLists: TurnsTreePriceList[] },
    { departments: number; priceLists: number; services: number; categories: number }
  >((body) => api.post('/catalog/sync-from-turns', body), {
    success: '',
    invalidate: [['price-lists'], ['services'], ['categories'], ['departments'], ['catalog-tree']],
  });

export const useStores = (params?: Params) =>
  useQuery(listQuery<Store>('/stores', qk.stores(params), params));

export const useStore = (id?: string) =>
  useQuery({
    queryKey: qk.store(id ?? ''),
    queryFn: () => api.get<Store>(`/stores/${id}`),
    enabled: Boolean(id),
  });

// Stores are managed in turns-dashboard, not here — read-only in this app.

/* ------------------------------------------------------------------ users */

// Users are managed in turns-dashboard, not here.

/* ---------------------------------------------------------------- catalog */

export const useCatalogTree = (params?: Params) =>
  useQuery({
    queryKey: qk.catalogTree(params),
    queryFn: () => api.get<TreePriceList[]>('/catalog/tree', { params: clean(params) }),
  });

export const useDepartments = (params?: Params) =>
  useQuery(listQuery<Department>('/catalog/departments', qk.departments(params), params));

export const usePriceLists = (params?: Params) =>
  useQuery(listQuery<PriceList>('/catalog/price-lists', qk.priceLists(params), params));

export const useServices = (params?: Params) =>
  useQuery(listQuery<Service>('/catalog/services', qk.services(params), params));

export const useCategories = (params?: Params) =>
  useQuery(listQuery<Category>('/catalog/categories', qk.categories(params), params));

type CatalogLevel = 'departments' | 'price-lists' | 'services' | 'categories';

export const useSaveCatalogNode = (level: CatalogLevel) =>
  useApiMutation<{ id?: string; body: Record<string, unknown> }, unknown>(
    ({ id, body }) =>
      id ? api.patch(`/catalog/${level}/${id}`, body) : api.post(`/catalog/${level}`, body),
    { invalidate: [[level.replace('-', '')], ['catalog-tree'], [level]] },
  );

export const useDeleteCatalogNode = (level: CatalogLevel) =>
  useApiMutation<string, unknown>((id) => api.delete(`/catalog/${level}/${id}`), {
    invalidate: [[level], ['catalog-tree']],
  });

/* --------------------------------------------------------------- products */

export const useProducts = (params?: Params) =>
  useQuery(listQuery<Product>('/products', qk.products(params), params));

/** One item, including its photo, which the list omits. */
export const useProduct = (id?: string) =>
  useQuery({
    queryKey: qk.product(id ?? ''),
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: Boolean(id),
  });

export const useSaveProduct = () =>
  useApiMutation<{ id?: string; body: Record<string, unknown> }, Product>(
    ({ id, body }) =>
      id ? api.patch<Product>(`/products/${id}`, body) : api.post<Product>('/products', body),
    { invalidate: [['products'], ['catalog-tree']] },
  );

export const useDeleteProduct = () =>
  useApiMutation<string, unknown>((id) => api.delete(`/products/${id}`), {
    invalidate: [['products'], ['catalog-tree']],
  });

/* ------------------------------------------------------------ store items */

export const useStoreItems = (storeId?: string, params?: Params) =>
  useQuery({
    queryKey: qk.storeItems(storeId ?? '', params),
    queryFn: () => api.get<StoreItem[]>(`/stores/${storeId}/items`, { params: clean(params) }),
    enabled: Boolean(storeId),
  });

export const useAddStoreItem = (storeId?: string) =>
  useApiMutation<Record<string, unknown>, StoreItem>(
    (body) => api.post<StoreItem>(`/stores/${storeId}/items`, body),
    { success: 'Item added', invalidate: [['store-items'], ['catalog-tree']] },
  );

export const useUpdateStoreItem = () =>
  useApiMutation<{ id: string; body: Record<string, unknown> }, StoreItem>(
    ({ id, body }) => api.patch<StoreItem>(`/store-items/${id}`, body),
    { invalidate: [['store-items'], ['catalog-tree'], ['low-stock']] },
  );

export const useRemoveStoreItem = () =>
  useApiMutation<string, unknown>((id) => api.delete(`/store-items/${id}`), {
    invalidate: [['store-items'], ['catalog-tree']],
  });

export const useSyncStoreCatalog = (storeId?: string) =>
  useApiMutation<void, { added: number }>(() => api.post(`/stores/${storeId}/items/sync`), {
    invalidate: [['store-items'], ['catalog-tree']],
  });

/* ----------------------------------------------------------------- orders */

export const useOrders = (params?: Params) =>
  useQuery(listQuery<Order>('/orders', qk.orders(params), params));

export const useOrder = (id?: string) =>
  useQuery({
    queryKey: qk.order(id ?? ''),
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(id),
  });

export const useCreateOrder = () =>
  useApiMutation<Record<string, unknown>, Order>((body) => api.post<Order>('/orders', body), {
    success: 'Order created',
    invalidate: [['orders'], ['stats']],
  });

export const useTransitionOrder = () =>
  useApiMutation<{ id: string; status: OrderStatus; note?: string; reason?: string }, Order>(
    ({ id, ...body }) => api.post<Order>(`/orders/${id}/status`, body),
    { invalidate: [['orders'], ['order'], ['stats'], ['store-items'], ['low-stock']] },
  );

/* --------------------------------------------------------------- payments */

export const usePayments = (params?: Params) =>
  useQuery(listQuery<Payment>('/payments', qk.payments(params), params));

/**
 * One payment, including its receipt image — lists omit that field so they
 * don't carry a megabyte per row.
 */
export const usePayment = (id?: string) =>
  useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.get<Payment>(`/payments/${id}`),
    enabled: Boolean(id),
  });

export const useOutstanding = () =>
  useQuery({
    queryKey: qk.outstanding,
    queryFn: () =>
      api.get<{ storeId: string; storeName: string; outstanding: number; orders: number }[]>(
        '/payments/outstanding',
      ),
  });

export const useCreatePayment = () =>
  useApiMutation<Record<string, unknown>, Payment>((body) => api.post<Payment>('/payments', body), {
    success: 'Payment recorded',
    invalidate: [['payments'], ['orders'], ['order'], ['stats']],
  });

/** Full edit of a recorded payment: amount, method, status, dates, notes. */
export const useUpdatePayment = () =>
  useApiMutation<{ id: string; body: Record<string, unknown> }, Payment>(
    ({ id, body }) => api.patch<Payment>(`/payments/${id}`, body),
    { invalidate: [['payments'], ['payment'], ['orders'], ['order'], ['stats']] },
  );

export const useDeletePayment = () =>
  useApiMutation<string, unknown>((id) => api.delete(`/payments/${id}`), {
    invalidate: [['payments'], ['orders'], ['order'], ['stats']],
  });

export const useUpdatePaymentStatus = () =>
  useApiMutation<{ id: string; status: string; notes?: string }, Payment>(
    ({ id, ...body }) => api.patch<Payment>(`/payments/${id}/status`, body),
    { invalidate: [['payments'], ['orders'], ['stats']] },
  );

/* -------------------------------------------------------------- inventory */

export const useMovements = (params?: Params) =>
  useQuery(listQuery<StockMovement>('/inventory/movements', qk.movements(params), params));

export const useLowStock = (params?: Params) =>
  useQuery(listQuery<StoreItem>('/inventory/low-stock', qk.lowStock(params), params));

export const useRecordMovement = (storeId?: string) =>
  useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post(`/stores/${storeId}/stock`, body),
    {
      success: 'Stock updated',
      invalidate: [['movements'], ['store-items'], ['low-stock'], ['stats'], ['catalog-tree']],
    },
  );

// Expenses are not part of the app for now.

export type { PageMeta, UseQueryOptions };
