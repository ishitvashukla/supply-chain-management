import { useMemo, useState } from 'react';
import { useCatalogTree } from '@/api/hooks';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  stockHealthVariant,
} from '@/components/ui';
import { StoreSelect } from '@/components/StoreSelect';
import { useAuth } from '@/hooks/useAuth';
import { useActiveStoreId } from '@/store/useUiStore';
import { cn, formatCurrency } from '@/lib/utils';
import type { TreeProduct } from '@/types';
import { Icons } from '@/components/icons';

const ProductRow = ({ product }: { product: TreeProduct }) => {
  const overridden = product.price !== product.basePrice;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {product.code} · per {product.unit}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold">{formatCurrency(product.price)}</p>
          {/* Show the catalog price struck through when the store overrides it. */}
          {overridden && (
            <p className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.basePrice)}
            </p>
          )}
        </div>
        {product.storeItem ? (
          <Badge variant={stockHealthVariant(product.storeItem.stockHealth)}>
            {product.storeItem.quantityOnHand}
          </Badge>
        ) : (
          <Badge variant="muted">not stocked</Badge>
        )}
      </div>
    </div>
  );
};

/**
 * Renders the full hierarchy the customer app uses:
 * Department → Price list → Service → Category (optional) → Products.
 */
export const CatalogPage = () => {
  const { isAdmin, storeId } = useAuth();
  const selectedStore = useActiveStoreId(storeId, isAdmin);
  const [search, setSearch] = useState('');
  const [openServices, setOpenServices] = useState<Record<string, boolean>>({});

  const tree = useCatalogTree(selectedStore ? { storeId: selectedStore } : undefined);

  const filtered = useMemo(() => {
    const data = tree.data?.data ?? [];
    if (!search.trim()) return data;
    const needle = search.toLowerCase();
    const match = (p: TreeProduct) =>
      p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle);

    // Prune the tree to branches that still contain a match.
    return data
      .map((priceList) => ({
        ...priceList,
        services: priceList.services
          .map((service) => ({
            ...service,
            categories: service.categories
              .map((category) => ({ ...category, products: category.products.filter(match) }))
              .filter((category) => category.products.length),
            products: service.products.filter(match),
          }))
          .filter((service) => service.categories.length || service.products.length),
      }))
      .filter((priceList) => priceList.services.length);
  }, [tree.data, search]);

  const toggle = (id: string) => setOpenServices((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Department → price list → service → category → item"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          icon={<Icons.search />}
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <StoreSelect className="sm:max-w-xs" allLabel="Catalog prices (no store)" />
      </div>

      {tree.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            title="Nothing in the catalog"
            description={
              search ? 'No items match your search.' : 'Add departments and items to begin.'
            }
            icon={<Icons.folder />}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((priceList) => (
            <Card key={priceList.priceListId}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Icons.catalog className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{priceList.priceListName}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {priceList.department?.name ?? 'Department'}
                  </p>
                </div>
                {priceList.isDefaultForStore && <Badge variant="info">Default</Badge>}
              </CardHeader>

              <CardContent className="space-y-3">
                {priceList.services.map((service) => {
                  const isOpen = openServices[service.serviceId] ?? true;
                  const count =
                    service.products.length +
                    service.categories.reduce((sum, c) => sum + c.products.length, 0);

                  return (
                    <div key={service.serviceId} className="rounded-lg border border-border">
                      <button
                        onClick={() => toggle(service.serviceId)}
                        className="flex w-full items-center justify-between gap-2 p-3 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icons.chevronRight
                            className={cn(
                              'size-4 shrink-0 transition-transform',
                              isOpen && 'rotate-90',
                            )}
                          />
                          <span className="truncate font-medium">{service.serviceName}</span>
                        </span>
                        <Badge variant="secondary">{count}</Badge>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 border-t border-border p-3">
                          {service.categories.map((category) => (
                            <div key={category.categoryId} className="space-y-2">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Icons.products className="size-3" />
                                {category.categoryName}
                              </p>
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {category.products.map((product) => (
                                  <ProductRow key={product.id} product={product} />
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* Products filed straight under the service. */}
                          {service.products.length > 0 && (
                            <div className="space-y-2">
                              {service.categories.length > 0 && (
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Uncategorised
                                </p>
                              )}
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {service.products.map((product) => (
                                  <ProductRow key={product.id} product={product} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default CatalogPage;
