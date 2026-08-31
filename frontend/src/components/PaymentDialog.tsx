import { useEffect, useState } from 'react';
import { useCreatePayment, usePayment, useUpdatePayment } from '@/api/hooks';
import {
  Button,
  DatePicker,
  Dialog,
  Field,
  ImageUpload,
  Input,
  SelectMenu,
  Textarea,
  toOptions,
} from '@/components/ui';
import { formatCurrency, humanize } from '@/lib/utils';
import type { Payment, PaymentMethod, PaymentStatus } from '@/types';

const METHODS: PaymentMethod[] = ['ACH', 'CARD', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'];
const STATUSES: PaymentStatus[] = ['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED'];

const toDateInput = (value?: string | null): string => (value ? value.slice(0, 10) : '');

/**
 * Records a new payment, or edits an existing one when `payment` is supplied.
 * The two share a form because the fields and the balance rules are identical.
 */
export const PaymentDialog = ({
  open,
  onClose,
  orderId,
  balanceDue,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  /** Remaining balance, used to prefill and to hint the cap. */
  balanceDue: number;
  payment?: Payment | null;
}) => {
  const isEdit = Boolean(payment);
  const create = useCreatePayment();
  const update = useUpdatePayment();

  // The list omits the receipt, so fetch the full record when editing.
  const detail = usePayment(open && payment ? payment._id : undefined);
  const full = detail.data?.data ?? payment;

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('ACH');
  const [status, setStatus] = useState<PaymentStatus>('PAID');
  const [paidAt, setPaidAt] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState('');

  // Re-seed whenever the dialog opens, so a previous edit never leaks into the next.
  useEffect(() => {
    if (!open) return;
    setAmount(full ? String(full.amount) : balanceDue > 0 ? String(balanceDue) : '');
    setMethod(full?.method ?? 'ACH');
    setStatus(full?.status ?? 'PAID');
    setPaidAt(toDateInput(full?.paidAt));
    setTransactionId(full?.transactionId ?? '');
    setNotes(full?.notes ?? '');
    setReceiptImage(full?.receiptImage ?? '');
  }, [open, full, balanceDue]);

  const submit = async () => {
    const body = {
      amount: Number(amount),
      method,
      status,
      paidAt: paidAt || undefined,
      transactionId: transactionId || undefined,
      notes: notes || undefined,
      // '' clears an existing receipt; undefined leaves it untouched.
      receiptImage: receiptImage || (full?.receiptImage ? '' : undefined),
    };

    if (isEdit && payment) {
      await update.mutateAsync({ id: payment._id, body });
    } else {
      await create.mutateAsync({ ...body, order: orderId });
    }
    onClose();
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${payment?.reference}` : 'Record payment'}
      description={`Balance due ${formatCurrency(balanceDue)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} full className="sm:w-auto">
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!amount} full className="sm:w-auto">
            {isEdit ? 'Save changes' : 'Record'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Amount"
          required
          hint={isEdit ? 'Checked against the order total, ignoring this payment' : undefined}
        >
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <SelectMenu
              value={method}
              onChange={setMethod}
              options={toOptions(METHODS, humanize)}
              aria-label="Payment method"
            />
          </Field>
          <Field label="Status">
            <SelectMenu
              value={status}
              onChange={setStatus}
              options={toOptions(STATUSES, humanize)}
              aria-label="Payment status"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid on">
            <DatePicker value={paidAt} onChange={setPaidAt} aria-label="Paid on" />
          </Field>
          <Field label="Reference">
            <Input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Txn id"
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <ImageUpload
          label="Payment proof"
          hint="Bank transfer confirmation, receipt, or a screenshot"
          value={receiptImage}
          onChange={setReceiptImage}
        />
      </div>
    </Dialog>
  );
};
