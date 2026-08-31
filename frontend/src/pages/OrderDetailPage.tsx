import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useDeletePayment,
  useOrder,
  usePayment,
  usePayments,
  useTransitionOrder,
} from '@/api/hooks';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  Field,
  PageHeader,
  Skeleton,
  Textarea,
  buttonVariants,
  orderStatusVariant,
  paymentStatusVariant,
} from '@/components/ui';
import { PaymentDialog } from '@/components/PaymentDialog';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, formatPack, humanize } from '@/lib/utils';
import type { OrderStatus, Payment } from '@/types';
import { Icons } from '@/components/icons';


export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { data, isLoading } = useOrder(id);
  const transition = useTransitionOrder();
  const payments = usePayments({ order: id, limit: 50 });
  const deletePayment = useDeletePayment();

  const [confirm, setConfirm] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const receipt = usePayment(viewingReceipt?._id);

  const order = data?.data;

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!order) return <p className="text-sm text-muted-foreground">Order not found.</p>;

  const run = async (status: OrderStatus) => {
    await transition.mutateAsync({ id: order._id, status, reason: reason || undefined });
    setConfirm(null);
    setReason('');
  };

  // Which buttons make sense is driven by the same state machine as the API.
  const canSubmit = order.status === 'DRAFT';
  const canDecide = isAdmin && order.status === 'PENDING';
  const canFulfil = isAdmin && order.status === 'APPROVED';
  const canCancel = ['DRAFT', 'PENDING', 'APPROVED'].includes(order.status);
  const canPay = isAdmin && order.balanceDue > 0 && order.status !== 'CANCELLED';

  return (
    <>
      <div className="flex items-center gap-2">
        <Link to="/orders" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <Icons.back />
        </Link>
        <span className="text-sm text-muted-foreground">Back to orders</span>
      </div>

      <PageHeader
        title={order.orderNumber}
        description={`${order.store?.name} · raised by ${order.placedBy?.name}${
          order.placedByAdmin ? ' (head office)' : ''
        }`}
        actions={
          <>
            {canSubmit && (
              <Button onClick={() => setConfirm({ status: 'PENDING', label: 'Submit for approval' })}>
                Submit
              </Button>
            )}
            {canDecide && (
              <>
                <Button
                  variant="success"
                  onClick={() => setConfirm({ status: 'APPROVED', label: 'Approve order' })}
                >
                  <Icons.approve /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirm({ status: 'REJECTED', label: 'Reject order' })}
                >
                  <Icons.close /> Reject
                </Button>
              </>
            )}
            {canFulfil && (
              <Button onClick={() => setConfirm({ status: 'FULFILLED', label: 'Mark delivered' })}>
                <Icons.deliver /> Mark delivered
              </Button>
            )}
            {canPay && (
              <Button variant="outline" onClick={() => setPayOpen(true)}>
                <Icons.payments /> Record payment
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                onClick={() => setConfirm({ status: 'CANCELLED', label: 'Cancel order' })}
              >
                Cancel
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={orderStatusVariant(order.status)}>{humanize(order.status)}</Badge>
        <Badge variant={paymentStatusVariant(order.paymentStatus)}>
          {humanize(order.paymentStatus)}
        </Badge>
        <Badge variant="secondary">{humanize(order.priority)}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.items.map((item) => (
              <div
                key={item.product}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.code} · {item.quantity} × {formatCurrency(item.unitPrice)} /{' '}
                    {formatPack(item.packSize, item.unit)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}

            <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">{formatCurrency(order.taxTotal)}</dd>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="tabular-nums">{formatCurrency(order.deliveryFee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(order.total)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Paid</dt>
                <dd className="tabular-nums">{formatCurrency(order.amountPaid)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatCurrency(order.balanceDue)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.timeline.map((event, index) => (
                <div key={`status-${index}`} className="flex gap-3">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{humanize(event.status)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                    {event.note && <p className="mt-0.5 text-xs">{event.note}</p>}
                  </div>
                </div>
              ))}

              {/* Payment edits are recorded separately, with what changed. */}
              {order.activity?.map((entry, index) => (
                <div key={`activity-${index}`} className="flex gap-3">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-info" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {humanize(entry.type)}
                      {entry.reference && (
                        <span className="font-normal text-muted-foreground"> · {entry.reference}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                    {entry.changes?.map((change) => (
                      <p key={change.field} className="mt-0.5 text-xs">
                        <span className="text-muted-foreground">{humanize(change.field)}:</span>{' '}
                        <span className="line-through opacity-60">{change.from}</span>
                        {' → '}
                        <span className="font-medium">{change.to}</span>
                      </p>
                    ))}
                    {entry.note && <p className="mt-0.5 text-xs">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Payments</CardTitle>
              {isAdmin && order.balanceDue > 0 && (
                <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {!payments.data?.data.length ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                payments.data.data.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatCurrency(entry.amount)}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {humanize(entry.method)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.reference} · {formatDateTime(entry.paidAt ?? entry.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={paymentStatusVariant(entry.status)}>
                        {humanize(entry.status)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setViewingReceipt(entry)}
                        aria-label={`View proof for ${entry.reference}`}
                      >
                        <Icons.receipt />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingPayment(entry)}
                            aria-label={`Edit ${entry.reference}`}
                          >
                            <Icons.edit />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeletingPayment(entry)}
                            aria-label={`Delete ${entry.reference}`}
                          >
                            <Icons.trash />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && run(confirm.status)}
        title={confirm?.label ?? ''}
        description={`This will move ${order.orderNumber} to ${confirm?.status.toLowerCase()}.`}
        confirmLabel={confirm?.label}
        destructive={confirm?.status === 'REJECTED' || confirm?.status === 'CANCELLED'}
        loading={transition.isPending}
      >
        {(confirm?.status === 'REJECTED' || confirm?.status === 'CANCELLED') && (
          <Field label="Reason" hint="Stored on the order and shown in its timeline">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this being turned down?"
            />
          </Field>
        )}
      </ConfirmDialog>

      <PaymentDialog
        open={payOpen || Boolean(editingPayment)}
        onClose={() => {
          setPayOpen(false);
          setEditingPayment(null);
        }}
        orderId={order._id}
        // When editing, the cap is the balance excluding that payment.
        balanceDue={
          editingPayment ? order.balanceDue + editingPayment.amount : order.balanceDue
        }
        payment={editingPayment}
      />

      <Dialog
        open={Boolean(viewingReceipt)}
        onClose={() => setViewingReceipt(null)}
        title={`Proof · ${viewingReceipt?.reference ?? ''}`}
        description={
          viewingReceipt
            ? `${formatCurrency(viewingReceipt.amount)} · ${humanize(viewingReceipt.method)}`
            : undefined
        }
      >
        {receipt.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : receipt.data?.data.receiptImage ? (
          <img
            src={receipt.data.data.receiptImage}
            alt={`Proof of payment ${viewingReceipt?.reference}`}
            className="max-h-[60dvh] w-full rounded-lg border border-border object-contain"
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No proof attached to this payment.
          </p>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={async () => {
          if (deletingPayment) await deletePayment.mutateAsync(deletingPayment._id);
          setDeletingPayment(null);
        }}
        title="Delete payment"
        description={`${deletingPayment?.reference} will be removed and the order's balance recalculated.`}
        confirmLabel="Delete"
        destructive
        loading={deletePayment.isPending}
      />

    </>
  );
};

export default OrderDetailPage;
