import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Extra input rendered under the description, e.g. a reason field. */
  children?: ReactNode;
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    description={description}
    size="sm"
    footer={
      <>
        <Button variant="outline" onClick={onClose} full className="sm:w-auto">
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          loading={loading}
          full
          className="sm:w-auto"
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {description ?? 'This action cannot be undone.'}
      </p>
      {children}
    </div>
  </Dialog>
);
