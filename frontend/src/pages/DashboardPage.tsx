import { Link, useNavigate } from 'react-router-dom';
import {
  useLowStock,
  useOrderTrend,
  useOrders,
  useOverview,
  useReorderForecast,
} from '@/api/hooks';
import { TrendChart } from '@/components/charts';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  buttonVariants,
  orderStatusVariant,
  stockHealthVariant,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';
import type { Order, StoreItem } from '@/types';
import { Icons } from '@/components/icons';

export const DashboardPage = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const overview = useOverview();
  const trend = useOrderTrend({ days: 30 });
  const recentOrders = useOrders({ limit: 5 });
  const lowStock = useLowStock();
  const forecast = useReorderForecast({ limit: 5 });

  const stats = overview.data?.data;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
        description={
          isAdmin ? 'Franchise-wide supply chain overview' : 'Your store at a glance'
        }
        actions={
          <Link to="/orders/new" className={buttonVariants()}>
            <Icons.add /> New order
          </Link>
        }
      />

      {/* 1 col on phones, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isAdmin ? 'Active stores' : 'Your store'}
          value={stats?.activeStores ?? 0}
          icon={<Icons.store />}
          loading={overview.isLoading}
        />
        <StatCard
          label="Open orders"
          value={stats?.openOrders ?? 0}
          hint={`${stats?.pendingApproval ?? 0} awaiting approval`}
          icon={<Icons.orders />}
          tone="info"
          loading={overview.isLoading}
        />
        <StatCard
          label="Stock at risk"
          value={stats?.itemsAtRisk ?? 0}
          hint={`across ${stats?.storesAtRisk ?? 0} store(s)`}
          icon={<Icons.alert />}
          tone="warning"
          loading={overview.isLoading}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats?.outstandingAmount ?? 0)}
          hint={`${stats?.outstandingOrders ?? 0} unpaid order(s)`}
          icon={<Icons.payments />}
          tone="danger"
          loading={overview.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Order value</CardTitle>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
            </div>
            <Icons.trend className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {trend.data?.data.length ? (
              <TrendChart data={trend.data.data} />
            ) : (
              <EmptyState title="No orders in this window" icon={<Icons.trend />} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs reordering</CardTitle>
            <p className="text-sm text-muted-foreground">Lowest cover first</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {forecast.data?.data.length ? (
              forecast.data.data.map((row) => (
                <div
                  key={row.storeItemId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.product?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.store?.name} · {row.quantityOnHand} on hand
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">+{row.suggestedQuantity}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Everything is stocked" description="No items need reordering." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link to="/orders" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              View all
            </Link>
          </CardHeader>
          <DataTable<Order>
            rows={recentOrders.data?.data ?? []}
            loading={recentOrders.isLoading}
            rowKey={(row) => row._id}
            onRowClick={(row) => navigate(`/orders/${row._id}`)}
            empty={{ title: 'No orders yet' }}
            columns={[
              {
                key: 'order',
                header: 'Order',
                render: (row) => (
                  <Link
                    to={`/orders/${row._id}`}
                    className="font-medium hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.orderNumber}
                  </Link>
                ),
              },
              {
                key: 'store',
                header: 'Store',
                hideBelow: 'lg',
                render: (row) => row.store?.name ?? '—',
              },
              {
                key: 'total',
                header: 'Amount',
                align: 'right',
                render: (row) => formatCurrency(row.total),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge variant={orderStatusVariant(row.status)}>{humanize(row.status)}</Badge>
                ),
              },
              {
                key: 'date',
                header: 'Date',
                hideBelow: 'xl',
                render: (row) => formatDate(row.createdAt),
              },
            ]}
            mobileCard={(row) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.orderNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.store?.name} · {formatDate(row.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCurrency(row.total)}</p>
                  <Badge variant={orderStatusVariant(row.status)}>{humanize(row.status)}</Badge>
                </div>
              </div>
            )}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Stock alerts</CardTitle>
            <Icons.expenses className="size-4 text-muted-foreground" />
          </CardHeader>
          <DataTable<StoreItem>
            rows={(lowStock.data?.data ?? []).slice(0, 6)}
            loading={lowStock.isLoading}
            rowKey={(row) => row._id}
            empty={{ title: 'No alerts', description: 'Every item is above its reorder point.' }}
            columns={[
              { key: 'product', header: 'Item', render: (row) => row.product?.name ?? '—' },
              {
                key: 'store',
                header: 'Store',
                hideBelow: 'lg',
                render: (row) => (typeof row.store === 'object' ? row.store.name : '—'),
              },
              {
                key: 'qty',
                header: 'On hand',
                align: 'right',
                render: (row) => `${row.quantityOnHand} ${row.product?.unit ?? ''}`,
              },
              {
                key: 'health',
                header: 'Status',
                render: (row) => (
                  <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
                ),
              },
            ]}
            mobileCard={(row) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.product?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typeof row.store === 'object' ? row.store.name : ''} · {row.quantityOnHand}{' '}
                    {row.product?.unit}
                  </p>
                </div>
                <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
};

export default DashboardPage;
