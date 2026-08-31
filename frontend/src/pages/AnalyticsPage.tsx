import {
  useFinancials,
  useOrderTrend,
  useOrdersByStatus,
  useReorderForecast,
  useTopConsumed,
} from '@/api/hooks';
import { CategoryBarChart, DonutChart, TrendChart } from '@/components/charts';
import { StoreSelect } from '@/components/StoreSelect';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  PageHeader,
  SelectMenu,
  StatCard,
  stockHealthVariant,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useActiveStoreId, useUiStore } from '@/store/useUiStore';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';
import type { ReorderRow } from '@/types';
import { Icons } from '@/components/icons';

export const AnalyticsPage = () => {
  const { isAdmin, storeId: ownStore } = useAuth();
  const storeId = useActiveStoreId(ownStore, isAdmin);
  const rangeDays = useUiStore((state) => state.rangeDays);
  const setRangeDays = useUiStore((state) => state.setRangeDays);

  const params = { storeId, days: rangeDays };
  const trend = useOrderTrend(params);
  const byStatus = useOrdersByStatus({ storeId });
  const consumed = useTopConsumed({ ...params, limit: 8 });
  const forecast = useReorderForecast({ storeId, limit: 20 });
  const financials = useFinancials(params);

  const fin = financials.data?.data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Usage, reorder forecasting and financial summary"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <StoreSelect className="sm:max-w-xs" />
        <SelectMenu
          value={String(rangeDays)}
          onChange={(next) => setRangeDays(Number(next))}
          className="sm:max-w-[11rem]"
          aria-label="Range"
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
            { value: '365', label: 'Last year' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Inventory value"
          value={formatCurrency(fin?.inventoryValue ?? 0)}
          icon={<Icons.inventory />}
          loading={financials.isLoading}
        />
        <StatCard
          label="Orders paid"
          value={formatCurrency(fin?.ordersPaid ?? 0)}
          hint={`last ${rangeDays} days`}
          icon={<Icons.wallet />}
          tone="success"
          loading={financials.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order value trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.data?.data.length ? (
              <TrendChart data={trend.data.data} height={260} />
            ) : (
              <EmptyState title="No orders in this window" icon={<Icons.trend />} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.data?.data.length ? (
              <DonutChart
                data={byStatus.data.data.map((row) => ({
                  label: humanize(row.status),
                  value: row.count,
                }))}
                height={260}
              />
            ) : (
              <EmptyState title="No orders yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most consumed</CardTitle>
            <p className="text-sm text-muted-foreground">By outbound stock movement</p>
          </CardHeader>
          <CardContent>
            {consumed.data?.data.length ? (
              <CategoryBarChart
                data={consumed.data.data.map((row) => ({ label: row.name, value: row.consumed }))}
                height={260}
              />
            ) : (
              <EmptyState title="No consumption recorded" />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Reorder forecast</CardTitle>
            <p className="text-sm text-muted-foreground">Suggested quantity for 30 days of cover</p>
          </CardHeader>
          <DataTable<ReorderRow>
            rows={forecast.data?.data ?? []}
            loading={forecast.isLoading}
            rowKey={(row) => row.storeItemId}
            empty={{ title: 'Nothing needs reordering' }}
            columns={[
              { key: 'product', header: 'Item', render: (row) => row.product?.name ?? '—' },
              {
                key: 'store',
                header: 'Store',
                hideBelow: 'lg',
                render: (row) => row.store?.name ?? '—',
              },
              { key: 'qty', header: 'On hand', align: 'right', render: (row) => row.quantityOnHand },
              {
                key: 'cover',
                header: 'Cover',
                align: 'right',
                hideBelow: 'md',
                render: (row) => (row.daysOfCover != null ? `${row.daysOfCover}d` : '—'),
              },
              {
                key: 'depletion',
                header: 'Runs out',
                hideBelow: 'xl',
                render: (row) => formatDate(row.depletionDate),
              },
              {
                key: 'suggest',
                header: 'Suggest',
                align: 'right',
                render: (row) => <span className="font-semibold">+{row.suggestedQuantity}</span>,
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
                    {row.store?.name} · {row.quantityOnHand} on hand
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">+{row.suggestedQuantity}</p>
                  <Badge variant={stockHealthVariant(row.stockHealth)}>{row.stockHealth}</Badge>
                </div>
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
};

export default AnalyticsPage;
