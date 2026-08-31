import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeletePayment, useOutstanding, usePayments } from '@/api/hooks';
import { CategoryBarChart } from '@/components/charts';
import { Icons } from '@/components/icons';
import { PaymentDialog } from '@/components/PaymentDialog';
import { StoreSelect } from '@/components/StoreSelect';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SelectMenu,
  paymentStatusVariant,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useActiveStoreId } from '@/store/useUiStore';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';
import type { Payment, PaymentStatus } from '@/types';

const STATUSES: PaymentStatus[] = ['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED'];

export const PaymentsPage = () => {
  const { isAdmin, storeId: ownStore } = useAuth();
  const storeId = useActiveStoreId(ownStore, isAdmin);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const removePayment = useDeletePayment();

  const payments = usePayments({ page, limit: 20, storeId, status });
  const outstanding = useOutstanding();

  const chartData =
    outstanding.data?.data.map((row) => ({ label: row.storeName, value: row.outstanding })) ?? [];

  return (
    <>
      <PageHeader title="Payments" description="Payment records against purchase orders" />

      <div className="flex flex-col gap-2 sm:flex-row">
        <StoreSelect className="sm:max-w-xs" />
        <SelectMenu
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          className="sm:max-w-xs"
          placeholder="All statuses"
          clearLabel="All statuses"
          aria-label="Payment status"
          options={STATUSES.map((value) => ({ value, label: humanize(value) }))}
        />
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding by store</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length ? (
              <CategoryBarChart data={chartData} />
            ) : (
              <EmptyState title="Nothing outstanding" description="Every order is settled." />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <DataTable<Payment>
          rows={payments.data?.data ?? []}
          loading={payments.isLoading}
          rowKey={(row) => row._id}
          onRowClick={(row) =>
            typeof row.order === 'object' ? navigate(`/orders/${row.order._id}`) : undefined
          }
          empty={{ title: 'No payments recorded' }}
          columns={[
            { key: 'ref', header: 'Reference', render: (row) => <span className="font-medium">{row.reference}</span> },
            {
              key: 'order',
              header: 'Order',
              render: (row) =>
                typeof row.order === 'object' ? (
                  <Link
                    to={`/orders/${row.order._id}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.order.orderNumber}
                  </Link>
                ) : (
                  '—'
                ),
            },
            {
              key: 'store',
              header: 'Store',
              hideBelow: 'lg',
              render: (row) => (typeof row.store === 'object' ? row.store.name : '—'),
            },
            { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount) },
            { key: 'method', header: 'Method', hideBelow: 'md', render: (row) => humanize(row.method) },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Badge variant={paymentStatusVariant(row.status)}>{humanize(row.status)}</Badge>
              ),
            },
            { key: 'date', header: 'Date', hideBelow: 'xl', render: (row) => formatDate(row.paidAt ?? row.createdAt) },
            ...(isAdmin
              ? [
                  {
                    key: 'actions',
                    header: '',
                    align: 'right' as const,
                    render: (row: Payment) => (
                      // stopPropagation: the row itself navigates to the order,
                      // and these actions must not trigger that.
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(row);
                          }}
                          aria-label={`Edit ${row.reference}`}
                        >
                          <Icons.edit />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleting(row);
                          }}
                          aria-label={`Delete ${row.reference}`}
                        >
                          <Icons.trash />
                        </Button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
          mobileCard={(row) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.reference}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {typeof row.order === 'object' ? row.order.orderNumber : ''} ·{' '}
                  {humanize(row.method)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatCurrency(row.amount)}</p>
                <Badge variant={paymentStatusVariant(row.status)}>{humanize(row.status)}</Badge>
              </div>
            </div>
          )}
        />
        <Pagination meta={payments.data?.meta} onPage={setPage} />
      </Card>

      {/* Editing only — new payments are raised from the order they belong to. */}
      <PaymentDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        orderId={editing && typeof editing.order === 'object' ? editing.order._id : ''}
        balanceDue={
          editing && typeof editing.order === 'object'
            ? editing.order.total - (editing.amount ?? 0) + editing.amount
            : (editing?.amount ?? 0)
        }
        payment={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await removePayment.mutateAsync(deleting._id);
          setDeleting(null);
        }}
        title="Delete payment"
        description={`${deleting?.reference} will be removed and its order's balance recalculated.`}
        confirmLabel="Delete"
        destructive
        loading={removePayment.isPending}
      />
    </>
  );
};

export default PaymentsPage;
