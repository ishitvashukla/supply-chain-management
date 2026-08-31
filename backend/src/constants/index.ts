export const ROLES = {
  ADMIN: 'ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  STORE_STAFF: 'STORE_STAFF',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES);

/** Store-scoped roles: these users may only ever touch their own store. */
export const STORE_ROLES: Role[] = [ROLES.STORE_MANAGER, ROLES.STORE_STAFF];

export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

/** Allowed status transitions. Anything not listed here is rejected. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['FULFILLED', 'CANCELLED'],
  REJECTED: [],
  FULFILLED: [],
  CANCELLED: [],
};

export const ORDER_PRIORITY = {
  STANDARD: 'STANDARD',
  URGENT: 'URGENT',
  EMERGENCY: 'EMERGENCY',
} as const;
export type OrderPriority = (typeof ORDER_PRIORITY)[keyof typeof ORDER_PRIORITY];
export const ORDER_PRIORITY_VALUES = Object.values(ORDER_PRIORITY);

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const PAYMENT_METHOD = {
  CASH: 'CASH',
  CARD: 'CARD',
  ACH: 'ACH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  CREDIT: 'CREDIT',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);

/** Why stock moved. Sign of the quantity is derived from this. */
export const STOCK_MOVEMENT = {
  RECEIPT: 'RECEIPT',
  CONSUMPTION: 'CONSUMPTION',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
  WASTAGE: 'WASTAGE',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
} as const;
export type StockMovement = (typeof STOCK_MOVEMENT)[keyof typeof STOCK_MOVEMENT];
export const STOCK_MOVEMENT_VALUES = Object.values(STOCK_MOVEMENT);

/** Movements that increase stock; everything else decreases it. */
export const INBOUND_MOVEMENTS: StockMovement[] = ['RECEIPT', 'RETURN', 'TRANSFER_IN'];

export const EXPENSE_CATEGORY = {
  SUPPLIES: 'SUPPLIES',
  UTILITIES: 'UTILITIES',
  MAINTENANCE: 'MAINTENANCE',
  PAYROLL: 'PAYROLL',
  RENT: 'RENT',
  LOGISTICS: 'LOGISTICS',
  OTHER: 'OTHER',
} as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORY)[keyof typeof EXPENSE_CATEGORY];
export const EXPENSE_CATEGORY_VALUES = Object.values(EXPENSE_CATEGORY);

export const STOCK_HEALTH = {
  OK: 'OK',
  LOW: 'LOW',
  CRITICAL: 'CRITICAL',
  OUT: 'OUT',
} as const;
export type StockHealth = (typeof STOCK_HEALTH)[keyof typeof STOCK_HEALTH];
