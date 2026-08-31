import { useEffect, useMemo } from 'react';
import {
  useCategories,
  usePriceLists,
  useServices,
  useStores,
  useSyncCatalogFromTurns,
  useTurnsPriceLists,
} from '@/api/hooks';
import { Field, SelectMenu } from '@/components/ui';
import type { Category, PriceList, Service, Store } from '@/types';

export interface Classification {
  /** Local store id. */
  store: string;
  /** Local ids, resolved from the turns lists once they are mirrored. */
  priceList: string;
  service: string;
  category: string;
}

/**
 * Store → price list → service → category.
 *
 * The lists are store-specific and owned by turns, so they are fetched live for
 * the chosen store and mirrored locally in the background. Each level resets
 * the ones below it: a service from another price list would be meaningless.
 */
export const ItemClassification = ({
  value,
  onChange,
  disabled,
}: {
  value: Classification;
  onChange: (next: Classification) => void;
  disabled?: boolean;
}) => {
  const stores = useStores({ limit: 200 });
  const store = stores.data?.data.find((s: Store) => s._id === value.store);

  // An empty picker is ambiguous — it could mean "no data" or "the request
  // failed". Say which, so a broken query is never mistaken for empty data.
  const storesError = stores.isError
    ? 'Could not load stores'
    : !stores.isLoading && !stores.data?.data.length
      ? 'No stores available — sync them first'
      : undefined;


  // Live lists for the selected store.
  const turnsLists = useTurnsPriceLists(store?.turnsStoreId ?? null);
  const syncCatalog = useSyncCatalogFromTurns();

  const listsError = turnsLists.isError ? 'Could not load this store’s price lists' : undefined;

  // Mirror the store's lists as soon as they arrive, so local ids exist.
  useEffect(() => {
    const lists = turnsLists.data;
    if (!lists?.length || !store?.turnsStoreId) return;
    syncCatalog.mutate({ turnsStoreId: store.turnsStoreId, priceLists: lists });
    // Only re-run when the store's lists actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnsLists.data, store?.turnsStoreId]);

  const priceListOptions = useMemo(
    () =>
      (turnsLists.data ?? []).map((list) => ({
        value: list.price_list_id,
        label: list.price_list_name,
        description: list.is_default_for_store ? 'Default for this store' : undefined,
      })),
    [turnsLists.data],
  );

  const selectedList = useMemo(
    () => (turnsLists.data ?? []).find((l) => l.price_list_id === value.priceList),
    [turnsLists.data, value.priceList],
  );

  const serviceOptions = useMemo(
    () =>
      (selectedList?.services ?? []).map((svc) => ({
        value: svc.service_id,
        label: svc.service_name,
        description: svc.department_name,
      })),
    [selectedList],
  );

  const selectedService = useMemo(
    () => (selectedList?.services ?? []).find((s) => s.service_id === value.service),
    [selectedList, value.service],
  );

  const categoryOptions = useMemo(
    () =>
      (selectedService?.categories ?? []).map((cat) => ({
        value: cat.cat_id,
        label: cat.cat_name,
      })),
    [selectedService],
  );

  const loadingLists = turnsLists.isLoading || syncCatalog.isPending;

  return (
    <>
      <Field
        label="Store"
        required
        hint={storesError ?? 'Determines which price lists apply'}
        error={storesError}
      >
        <SelectMenu
          value={value.store}
          onChange={(next) =>
            // Everything below depends on the store, so it all resets.
            onChange({ store: next, priceList: '', service: '', category: '' })
          }
          disabled={disabled}
          placeholder="Select a store…"
          aria-label="Store"
          searchable
          options={(stores.data?.data ?? []).map((s: Store) => ({
            value: s._id,
            label: s.name,
            description: s.code,
          }))}
        />
      </Field>

      <Field
        label="Price list"
        required
        hint={
          listsError ??
          (!value.store ? 'Pick a store first' : loadingLists ? 'Loading…' : undefined)
        }
        error={listsError}
      >
        <SelectMenu
          value={value.priceList}
          onChange={(next) => onChange({ ...value, priceList: next, service: '', category: '' })}
          disabled={disabled || !value.store || loadingLists}
          placeholder={value.store ? 'Select a price list…' : '—'}
          aria-label="Price list"
          options={priceListOptions}
        />
      </Field>

      <Field label="Service" required hint={!value.priceList ? 'Pick a price list first' : undefined}>
        <SelectMenu
          value={value.service}
          onChange={(next) => onChange({ ...value, service: next, category: '' })}
          disabled={disabled || !value.priceList}
          placeholder={value.priceList ? 'Select a service…' : '—'}
          aria-label="Service"
          searchable
          options={serviceOptions}
        />
      </Field>

      <Field
        label="Category"
        hint={
          !value.service
            ? 'Pick a service first'
            : categoryOptions.length
              ? 'Optional'
              : 'This service has no categories'
        }
      >
        <SelectMenu
          value={value.category}
          onChange={(next) => onChange({ ...value, category: next })}
          disabled={disabled || !value.service || !categoryOptions.length}
          placeholder="No category"
          clearLabel="No category"
          aria-label="Category"
          options={categoryOptions}
        />
      </Field>
    </>
  );
};

/**
 * Turns ids drive the form; the item stores local ids. This resolves one to
 * the other using the mirrored lists.
 */
export const useResolveClassification = () => {
  const priceLists = usePriceLists({ limit: 200 });
  const services = useServices({ limit: 500 });
  const categories = useCategories({ limit: 500 });

  return (value: Classification) => {
    const priceList = priceLists.data?.data.find(
      (p: PriceList) => p.turnsPriceListId === value.priceList,
    );
    const service = services.data?.data.find((s: Service) => s.turnsServiceId === value.service);
    const category = categories.data?.data.find(
      (c: Category) => c.turnsCategoryId === value.category,
    );

    return {
      priceList: priceList?._id ?? '',
      service: service?._id ?? '',
      category: category?._id ?? '',
    };
  };
};
