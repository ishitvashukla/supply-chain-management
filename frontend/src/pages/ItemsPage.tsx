import { useEffect, useState } from 'react';
import {
  useDeleteProduct,
  useProduct,
  useProducts,
  useSaveProduct,
  useServices,
} from '@/api/hooks';
import {
  ItemClassification,
  useResolveClassification,
  type Classification,
} from '@/components/ItemClassification';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  Field,
  ImageUpload,
  Input,
  PageHeader,
  Pagination,
  SelectMenu,
  Textarea,
} from '@/components/ui';
import { formatCurrency, formatPack } from '@/lib/utils';
import type { Product, Service } from '@/types';
import { Icons } from '@/components/icons';

const EMPTY_CLASSIFICATION: Classification = {
  store: '',
  priceList: '',
  service: '',
  category: '',
};

const EMPTY = {
  name: '',
  code: '',
  basePrice: '',
  packSize: '1',
  unit: '',
  description: '',
  defaultReorderThreshold: '0',
  defaultCriticalThreshold: '0',
  taxPercentage: '0',
  image: '',
};

/** Admin CRUD over the master item list. */
export const ItemsPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [classification, setClassification] = useState<Classification>(EMPTY_CLASSIFICATION);
  const resolve = useResolveClassification();

  const products = useProducts({ page, limit: 20, search, service: serviceFilter });
  const services = useServices({ limit: 100 });
  const save = useSaveProduct();
  // The list omits the photo, so load it when the edit dialog opens.
  const detail = useProduct(open && editingId ? editingId : undefined);
  const remove = useDeleteProduct();

  const openCreate = () => {
    setForm(EMPTY);
    setClassification(EMPTY_CLASSIFICATION);
    setEditingId(null);
    setOpen(true);
  };

  // Fill the photo in once the detail arrives.
  useEffect(() => {
    const image = detail.data?.data.image;
    if (image) setForm((prev) => (prev.image ? prev : { ...prev, image }));
  }, [detail.data]);

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      code: product.code,
      basePrice: String(product.basePrice),
      packSize: String(product.packSize ?? 1),
      unit: product.unit,
      description: product.description ?? '',
      defaultReorderThreshold: String(product.defaultReorderThreshold),
      defaultCriticalThreshold: String(product.defaultCriticalThreshold),
      taxPercentage: String(product.taxes?.[0]?.percentage ?? 0),
      image: product.image ?? '',
    });
    // Classification is set when the item is created and not re-picked here.
    setClassification(EMPTY_CLASSIFICATION);
    setEditingId(product._id);
    setOpen(true);
  };

  const submit = async () => {
    const tax = Number(form.taxPercentage);
    const local = resolve(classification);

    await save.mutateAsync({
      id: editingId ?? undefined,
      body: {
        name: form.name,
        code: form.code,
        basePrice: Number(form.basePrice),
        packSize: Number(form.packSize),
        unit: form.unit,
        description: form.description || undefined,
        defaultReorderThreshold: Number(form.defaultReorderThreshold),
        defaultCriticalThreshold: Number(form.defaultCriticalThreshold),
        taxes: tax > 0 ? [{ name: 'Tax', percentage: tax }] : [],
        image: form.image || undefined,
        // Only sent on create; an existing item keeps its classification.
        ...(editingId
          ? {}
          : {
              service: local.service,
              priceList: local.priceList,
              category: local.category || null,
              store: classification.store,
              storePrice: Number(form.basePrice),
            }),
      },
    });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Items"
        description="The master item list shared by every store"
        actions={
          <Button onClick={openCreate}>
            <Icons.add /> New item
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          icon={<Icons.search />}
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <SelectMenu
          value={serviceFilter}
          onChange={(next) => {
            setServiceFilter(next);
            setPage(1);
          }}
          className="sm:max-w-xs"
          placeholder="All services"
          clearLabel="All services"
          aria-label="Service"
          options={(services.data?.data ?? []).map((service: Service) => ({
            value: service._id,
            label: service.name,
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable<Product>
          rows={products.data?.data ?? []}
          loading={products.isLoading}
          rowKey={(row) => row._id}
          empty={{ title: 'No items', description: 'Create the first item in your catalog.' }}
          columns={[
            {
              key: 'name',
              header: 'Item',
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.code}</p>
                </div>
              ),
            },
            {
              key: 'service',
              header: 'Service',
              hideBelow: 'md',
              render: (row) => (typeof row.service === 'object' ? row.service.name : '—'),
            },
            {
              key: 'category',
              header: 'Category',
              hideBelow: 'lg',
              render: (row) =>
                row.category && typeof row.category === 'object' ? (
                  row.category.name
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            { key: 'price', header: 'Price', align: 'right', render: (row) => formatCurrency(row.basePrice) },
            {
              key: 'pack',
              header: 'Pack',
              hideBelow: 'xl',
              render: (row) => formatPack(row.packSize, row.unit),
            },
            {
              key: 'active',
              header: 'Status',
              render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'muted'}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)} aria-label="Edit">
                    <Icons.edit />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(row)} aria-label="Delete">
                    <Icons.trash />
                  </Button>
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.code} · {formatCurrency(row.basePrice)} / {formatPack(row.packSize, row.unit)}
                  </p>
                </div>
                <Badge variant={row.isActive ? 'success' : 'muted'}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" full onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" full onClick={() => setDeleting(row)}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        />
        <Pagination meta={products.data?.meta} onPage={setPage} />
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit item' : 'New item'}
        description="Department and price list are inherited from the service."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} full className="sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={submit}
              loading={save.isPending}
              // A new item is meaningless without a store, price list and service.
              disabled={
                !editingId &&
                (!classification.store || !classification.priceList || !classification.service)
              }
              full
              className="sm:w-auto"
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {!editingId && (
            <ItemClassification value={classification} onChange={setClassification} />
          )}

          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Code" required>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Pack size" hint="How much is in one unit you order">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.packSize}
              onChange={(e) => setForm({ ...form, packSize: e.target.value })}
              placeholder="5"
            />
          </Field>
          <Field
            label="Unit"
            required
            hint={
              form.packSize && form.unit
                ? `One unit = ${form.packSize} ${form.unit}`
                : 'L, kg, box, pieces…'
            }
          >
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="L"
            />
          </Field>
          <Field
            label="Base price"
            required
            hint={form.unit ? `Per ${formatPack(Number(form.packSize), form.unit)}` : undefined}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            />
          </Field>
          <Field label="Tax %">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.taxPercentage}
              onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })}
            />
          </Field>
          <Field label="Reorder at">
            <Input
              type="number"
              min="0"
              value={form.defaultReorderThreshold}
              onChange={(e) => setForm({ ...form, defaultReorderThreshold: e.target.value })}
            />
          </Field>
          <Field label="Critical at">
            <Input
              type="number"
              min="0"
              value={form.defaultCriticalThreshold}
              onChange={(e) => setForm({ ...form, defaultCriticalThreshold: e.target.value })}
            />
          </Field>
          <ImageUpload
            className="sm:col-span-2"
            label="Item photo"
            hint="Helps staff pick the right material when ordering"
            value={form.image}
            onChange={(next) => setForm({ ...form, image: next })}
          />

          <Field label="Description" className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting._id);
          setDeleting(null);
        }}
        title="Delete item"
        description={`"${deleting?.name}" will be removed from the catalog. Items already stocked by a store cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </>
  );
};

export default ItemsPage;
