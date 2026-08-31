import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogTree, useCreateOrder, useStores } from '@/api/hooks';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  DatePicker,
  Input,
  PageHeader,
  SelectMenu,
  Textarea,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatCurrency, formatPack } from '@/lib/utils';
import type { OrderPriority, TreeProduct } from '@/types';
import { Icons } from '@/components/icons';

interface Line {
  product: TreeProduct;
  quantity: number;
}

const PRIORITIES: OrderPriority[] = ['STANDARD', 'URGENT', 'EMERGENCY'];

/**
 * Basket-style order builder. Prices shown are the ones the API will charge —
 * the store's override where one exists, otherwise the catalog price.
 */
export const NewOrderPage = () => {
  const navigate = useNavigate();
  const { isAdmin, storeId: ownStore } = useAuth();
  const createOrder = useCreateOrder();

  const [storeId, setStoreId] = useState(ownStore ?? '');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [priority, setPriority] = useState<OrderPriority>('STANDARD');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const stores = useStores({ limit: 100 });
  const tree = useCatalogTree(storeId ? { storeId } : undefined);

  const products = useMemo(() => {
    const all: TreeProduct[] = [];
    tree.data?.data.forEach((priceList) =>
      priceList.services.forEach((service) => {
        service.categories.forEach((category) => all.push(...category.products));
        all.push(...service.products);
      }),
    );
    const needle = search.trim().toLowerCase();
    return needle
      ? all.filter(
          (p) => p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle),
        )
      : all;
  }, [tree.data, search]);

  const basket = Object.values(lines);
  const subtotal = basket.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const tax = basket.reduce((sum, line) => {
    const rate = line.product.taxes.reduce((t, item) => t + item.percentage, 0);
    return sum + (line.product.price * line.quantity * rate) / 100;
  }, 0);

  const setQuantity = (product: TreeProduct, quantity: number) =>
    setLines((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = { product, quantity };
      return next;
    });

  const submit = async (submitForApproval: boolean) => {
    if (!storeId || !basket.length) return;
    const res = await createOrder.mutateAsync({
      store: isAdmin ? storeId : undefined,
      items: basket.map((line) => ({ product: line.product.id, quantity: line.quantity })),
      priority,
      notes: notes || undefined,
      requestedDeliveryDate: deliveryDate || undefined,
      submit: submitForApproval,
    });
    navigate(`/orders/${res.data._id}`);
  };

  return (
    <>
      <PageHeader
        title="New order"
        description={isAdmin ? 'Raise an order for any store' : 'Raise an order for your store'}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>1 · Order details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {isAdmin && (
                <Field label="Ordering store" required>
                  <SelectMenu
                    value={storeId}
                    onChange={setStoreId}
                    placeholder="Select a store…"
                    aria-label="Ordering store"
                    options={(stores.data?.data ?? []).map((store) => ({
                      value: store._id,
                      label: store.name,
                      description: store.code,
                    }))}
                  />
                </Field>
              )}
              <Field label="Priority">
                <SelectMenu
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITIES.map((value) => ({ value, label: value }))}
                  aria-label="Priority"
                />
              </Field>
              <Field label="Requested delivery">
                <DatePicker
                  value={deliveryDate}
                  onChange={setDeliveryDate}
                  min={new Date().toISOString().slice(0, 10)}
                  placeholder="Any date"
                  aria-label="Requested delivery date"
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  placeholder="Anything the approver should know…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <CardTitle>2 · Select items</CardTitle>
              <Input
                icon={<Icons.search />}
                placeholder="Search the catalog…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </CardHeader>
            <CardContent>
              {!storeId ? (
                <EmptyState
                  title="Pick a store first"
                  description="Prices and availability depend on the location."
                />
              ) : !products.length ? (
                <EmptyState title="No items found" />
              ) : (
                <div className="space-y-2">
                  {products.map((product) => {
                    const line = lines[product.id];
                    const unavailable = product.storeItem?.isAvailable === false;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg border border-border p-3',
                          line && 'border-primary/40 bg-primary/5',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatCurrency(product.price)} / {formatPack(product.packSize, product.unit)}
                            {product.storeItem
                              ? ` · ${product.storeItem.quantityOnHand} on hand`
                              : ' · not stocked here'}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={!line}
                            onClick={() => setQuantity(product, (line?.quantity ?? 0) - 1)}
                            aria-label={`Remove one ${product.name}`}
                          >
                            <Icons.remove />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium tabular-nums">
                            {line?.quantity ?? 0}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={unavailable}
                            onClick={() => setQuantity(product, (line?.quantity ?? 0) + 1)}
                            aria-label={`Add one ${product.name}`}
                          >
                            <Icons.add />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary sticks to the viewport on desktop, flows inline on mobile. */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Summary</CardTitle>
              <Badge variant="secondary">{basket.length} line(s)</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {!basket.length ? (
                <EmptyState
                  title="Basket is empty"
                  description="Add items to build the order."
                  icon={<Icons.cart />}
                />
              ) : (
                <>
                  <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
                    {basket.map((line) => (
                      <div key={line.product.id} className="flex items-center gap-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{line.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.quantity} × {formatCurrency(line.product.price)}
                          </p>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatCurrency(line.product.price * line.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setQuantity(line.product, 0)}
                          aria-label={`Remove ${line.product.name}`}
                        >
                          <Icons.trash />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tax</dt>
                      <dd className="tabular-nums">{formatCurrency(tax)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{formatCurrency(subtotal + tax)}</dd>
                    </div>
                  </dl>

                  <div className="space-y-2 pt-1">
                    <Button
                      full
                      loading={createOrder.isPending}
                      disabled={!storeId}
                      onClick={() => submit(true)}
                    >
                      Submit for approval
                    </Button>
                    <Button
                      full
                      variant="outline"
                      disabled={!storeId || createOrder.isPending}
                      onClick={() => submit(false)}
                    >
                      Save as draft
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default NewOrderPage;
