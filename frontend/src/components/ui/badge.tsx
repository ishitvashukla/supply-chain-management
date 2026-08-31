import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus, StockHealth } from '@/types';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success/12 text-success',
        warning: 'border-transparent bg-warning/15 text-warning',
        danger: 'border-transparent bg-destructive/12 text-destructive',
        info: 'border-transparent bg-info/12 text-info',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

/* --- domain-aware mappings, so status colour is decided in exactly one place --- */

const ORDER_VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  DRAFT: 'muted',
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  FULFILLED: 'success',
  CANCELLED: 'secondary',
};

const PAYMENT_VARIANT: Record<PaymentStatus, BadgeProps['variant']> = {
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'secondary',
};

const STOCK_VARIANT: Record<StockHealth, BadgeProps['variant']> = {
  OK: 'success',
  LOW: 'warning',
  CRITICAL: 'danger',
  OUT: 'danger',
};

export const orderStatusVariant = (status: OrderStatus) => ORDER_VARIANT[status] ?? 'muted';
export const paymentStatusVariant = (status: PaymentStatus) => PAYMENT_VARIANT[status] ?? 'muted';
export const stockHealthVariant = (health: StockHealth) => STOCK_VARIANT[health] ?? 'muted';

export { badgeVariants };
