import { useStores } from '@/api/hooks';
import { SelectMenu } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/useUiStore';

/**
 * Store scope picker backed by the Zustand store, so the choice follows the
 * user across pages. Hidden for store users, who are pinned to their own store.
 */
export const StoreSelect = ({
  className,
  allLabel = 'All stores',
}: {
  className?: string;
  allLabel?: string;
}) => {
  const { isAdmin } = useAuth();
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const stores = useStores({ limit: 100 });

  if (!isAdmin) return null;

  return (
    <SelectMenu
      value={selectedStoreId}
      onChange={setSelectedStoreId}
      className={className}
      placeholder={allLabel}
      clearLabel={allLabel}
      aria-label="Store"
      options={(stores.data?.data ?? []).map((store) => ({
        value: store._id,
        label: store.name,
        description: store.code,
      }))}
    />
  );
};
