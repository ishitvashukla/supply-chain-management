import { useState } from 'react';
import {
  useMovements,
  useRecordMovement,
  useStoreItems,
  useSyncStoreCatalog,
  useUpdateStoreItem,
} from '@/api/hooks';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Field,
  Input,
  PageHeader,
  Pagination,
  SelectMenu,
  stockHealthVariant,
} from '@/components/ui';
import { StoreSelect } from '@/components/StoreSelect';
import { useAuth } from '@/hooks/useAuth';
import { useActiveStoreId } from '@/store/useUiStore';
import { formatCurrency, formatDateTime, formatPack, humanize } from '@/lib/utils';
import type { StockMovement, StockMovementType, StoreItem } from '@/types';
import { Icons } from '@/components/icons';

const MOVEMENTS: StockMovementType[] = [
  'RECEIPT',
  'CONSUMPTION',
  'ADJUSTMENT',
  'RETURN',
  'WASTAGE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
];

export const InventoryPage = () => {
  const { isAdmin, storeId: ownStore } = useAuth();
  const storeId = useActiveStoreId(ownStore, isAdmin);
  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('');
  const [page, setPage] = useState(1);

  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState<StoreItem | null>(null);
  const [type, setType] = useState<StockMovementType>('RECEIPT');
  const [quantity, setQuantity] = useState('');

  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [price, setPrice] = useState('');
  const [reorder, setReorder] = useState('');
  const [critical, setCritical] = useState('');

  const items = useStoreItems(storeId, { page, limit: 20, search, health });
  const movements = useMovements({ storeId, limit: 20 });
  const recordMovement = useRecordMovement(storeId);
  const updateItem = useUpdateStoreItem();
  const syncCatalog = useSyncStoreCatalog(storeId);

  const openMovement = (item: StoreItem) => {
    setTarget(item);
    setQuantity('');
    setType('RECEIPT');
    setMoveOpen(true);
  };

  const openEdit = (item: StoreItem) => {
    setEditing(item);
    setPrice(item.price != null ? String(item.price) : '');
    setReorder(String(item.reorderThreshold));
    setCritical(String(item.criticalThreshold));
  };

  const saveMovement = async () => {
    if (!target) return;
    await recordMovement.mutateAsync({
      product: target.product._id,
      type,
      quantity: Number(quantity),
    });
    setMoveOpen(false);
  };

  const saveItem = async () => {
    if (!editing) return;
    await updateItem.mutateAsync({
      id: editing._id,
      body: {
        // Empty means "fall back to the catalog price", which the API stores as null.
        price: price === '' ? null : Number(price),
        reorderThreshold: Number(reorder),
        criticalThreshold: Number(critical),
      },
    });
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Per-location item list, stock levels and movement history"
        actions={
          storeId && (
            <Button variant="outline" onClick={() => syncCatalog.mutate()} loading={syncCatalog.isPending}>
              <Icons.refresh /> Sync catalog
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
          {(['items', 'movements'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <StoreSelect className="sm:max-w-xs" allLabel="Select a store…" />

        {tab === 'items' && (
          <>
            <Input
              icon={<Icons.search />}
              placeholder="Search items…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="sm:max-w-xs"
            />
            <SelectMenu
              value={health}
              onChange={setHealth}
              className="sm:max-w-[10rem]"
              placeholder="All stock"
              clearLabel="All stock"
              aria-label="Stock level"
              options={[
                { value: 'OK', label: 'OK' },
                { value: 'LOW', label: 'Low' },
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'OUT', label: 'Out of stock' },
              ]}
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {tab === 'items' ? (
          <>
            <DataTable<StoreItem>
              rows={items.data?.data ?? []}
              loading={items.isLoading}
              rowKey={(row) => row._id}
              empty={{
                title: storeId ? 'No items for this store' : 'Choose a store',
                description: storeId
                  ? 'Use "Sync catalog" to add every active item.'
                  : 'Pick a location to see its item list.',
              }}
              columns={[
                {
                  key: 'product',
                  header: 'Item',
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.product?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.product?.code}</p>
                    </div>
                  ),
                },
                {
                  key: 'price',
                  header: 'Price',
                  align: 'right',
                  hideBelow: 'md',
                  render: (row) =>
                    row.price != null ? (
                      <span className="font-medium">{formatCurrency(row.price)}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatCurrency(row.product?.basePrice ?? 0)}
                      </span>
                    ),
                },
                {
                  key: 'qty',
                  header: 'On hand',
                  align: 'right',
                  render: (row) =>
                    `${row.quantityOnHand} × ${formatPack(row.product?.packSize, row.product?.unit)}`,
                },
                {
                  key: 'thresholds',
                  header: 'Reorder / critical',
                  align: 'right',
                  hideBelow: 'lg',
                  render: (row) => `${row.reorderThreshold} / ${row.criticalThreshold}`,
                },
                {
                  key: 'health',
                  header: 'Status',
                  render: (row) => (
                    <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => openMovement(row)}>
                        <Icons.package /> Stock
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    </div>
                  ),
                },
              ]}
              mobileCard={(row) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.product?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatCurrency(row.price ?? row.product?.basePrice ?? 0)} ·{' '}
                        {row.quantityOnHand} {row.product?.unit}
                      </p>
                    </div>
                    <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" full onClick={() => openMovement(row)}>
                      Stock
                    </Button>
                    <Button variant="ghost" size="sm" full onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                  </div>
                </div>
              )}
            />
            <Pagination meta={items.data?.meta} onPage={setPage} />
          </>
        ) : (
          <DataTable<StockMovement>
            rows={movements.data?.data ?? []}
            loading={movements.isLoading}
            rowKey={(row) => row._id}
            empty={{ title: 'No stock movements yet' }}
            columns={[
              { key: 'product', header: 'Item', render: (row) => row.product?.name ?? '—' },
              {
                key: 'type',
                header: 'Type',
                render: (row) => <Badge variant="secondary">{humanize(row.type)}</Badge>,
              },
              {
                key: 'delta',
                header: 'Change',
                align: 'right',
                render: (row) => (
                  <span className={row.delta >= 0 ? 'text-success' : 'text-destructive'}>
                    {row.delta >= 0 ? '+' : ''}
                    {row.delta}
                  </span>
                ),
              },
              { key: 'balance', header: 'Balance', align: 'right', hideBelow: 'md', render: (row) => row.balanceAfter },
              {
                key: 'when',
                header: 'When',
                hideBelow: 'lg',
                render: (row) => formatDateTime(row.occurredAt),
              },
            ]}
            mobileCard={(row) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.product?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {humanize(row.type)} · {formatDateTime(row.occurredAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    row.delta >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {row.delta >= 0 ? '+' : ''}
                  {row.delta}
                </span>
              </div>
            )}
          />
        )}
      </Card>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Record stock movement"
        description={target?.product?.name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)} full className="sm:w-auto">
              Cancel
            </Button>
            <Button onClick={saveMovement} loading={recordMovement.isPending} full className="sm:w-auto">
              Record
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Movement type">
            <SelectMenu
              value={type}
              onChange={setType}
              options={MOVEMENTS.map((value) => ({ value, label: humanize(value) }))}
              aria-label="Movement type"
            />
          </Field>
          <Field label="Quantity" required hint={`Currently ${target?.quantityOnHand ?? 0} on hand`}>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit store item"
        description={editing?.product?.name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} full className="sm:w-auto">
              Cancel
            </Button>
            <Button onClick={saveItem} loading={updateItem.isPending} full className="sm:w-auto">
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label="Price override"
            hint={`Leave blank to use the catalog price (${formatCurrency(
              editing?.product?.basePrice ?? 0,
            )})`}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Catalog price"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder at">
              <Input type="number" min="0" value={reorder} onChange={(e) => setReorder(e.target.value)} />
            </Field>
            <Field label="Critical at">
              <Input type="number" min="0" value={critical} onChange={(e) => setCritical(e.target.value)} />
            </Field>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default InventoryPage;
