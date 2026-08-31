import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrders, useStores } from '@/api/hooks';
import {
  Badge,
  Card,
  DataTable,
  Input,
  PageHeader,
  Pagination,
  SelectMenu,
  buttonVariants,
  orderStatusVariant,
  paymentStatusVariant,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';
import { Icons } from '@/components/icons';

const STATUSES: OrderStatus[] = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FULFILLED',
  'CANCELLED',
];

export const OrdersPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');

  const stores = useStores({ limit: 100 });
  const { data, isLoading } = useOrders({ page, limit: 20, status, storeId, search });

  return (
    <>
      <PageHeader
        title="Orders"
        description="Purchase orders raised by stores or by head office"
        actions={
          <Link to="/orders/new" className={buttonVariants()}>
            <Icons.add /> New order
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          icon={<Icons.search />}
          placeholder="Order number…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectMenu
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          placeholder="All statuses"
          clearLabel="All statuses"
          aria-label="Status"
          options={STATUSES.map((value) => ({ value, label: humanize(value) }))}
        />
        {isAdmin && (
          <SelectMenu
            value={storeId}
            onChange={(next) => {
              setStoreId(next);
              setPage(1);
            }}
            placeholder="All stores"
            clearLabel="All stores"
            aria-label="Store"
            options={(stores.data?.data ?? []).map((store) => ({
              value: store._id,
              label: store.name,
              description: store.code,
            }))}
          />
        )}
      </div>

      <Card className="overflow-hidden">
        <DataTable<Order>
          rows={data?.data ?? []}
          loading={isLoading}
          rowKey={(row) => row._id}
          // The whole row is the target — the order number alone was too small
          // a hit area to be discoverable.
          onRowClick={(row) => navigate(`/orders/${row._id}`)}
          empty={{
            title: 'No orders found',
            description: 'Try clearing the filters, or raise a new order.',
          }}
          columns={[
            {
              key: 'number',
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
            { key: 'store', header: 'Store', hideBelow: 'lg', render: (row) => row.store?.name ?? '—' },
            {
              key: 'by',
              header: 'Raised by',
              hideBelow: 'xl',
              render: (row) => (
                <span className="flex items-center gap-1.5">
                  {row.placedBy?.name ?? '—'}
                  {row.placedByAdmin && <Badge variant="info">admin</Badge>}
                </span>
              ),
            },
            { key: 'items', header: 'Items', align: 'right', hideBelow: 'md', render: (row) => row.items.length },
            { key: 'total', header: 'Total', align: 'right', render: (row) => formatCurrency(row.total) },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Badge variant={orderStatusVariant(row.status)}>{humanize(row.status)}</Badge>
              ),
            },
            {
              key: 'payment',
              header: 'Payment',
              hideBelow: 'lg',
              render: (row) => (
                <Badge variant={paymentStatusVariant(row.paymentStatus)}>
                  {humanize(row.paymentStatus)}
                </Badge>
              ),
            },
            { key: 'date', header: 'Date', hideBelow: 'xl', render: (row) => formatDate(row.createdAt) },
            {
              key: 'open',
              header: '',
              align: 'right',
              // Visible affordance that the row leads somewhere.
              render: () => <Icons.chevronRight className="ml-auto size-4 text-muted-foreground" />,
            },
          ]}
          mobileCard={(row) => (
            <Link to={`/orders/${row._id}`} className="block space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.orderNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.store?.name} · {row.items.length} item(s)
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatCurrency(row.total)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={orderStatusVariant(row.status)}>{humanize(row.status)}</Badge>
                <Badge variant={paymentStatusVariant(row.paymentStatus)}>
                  {humanize(row.paymentStatus)}
                </Badge>
                {row.placedByAdmin && <Badge variant="info">admin raised</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(row.createdAt)}
                </span>
              </div>
            </Link>
          )}
        />
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
};

export default OrdersPage;
