export type Role = 'ADMIN' | 'STORE_MANAGER' | 'STORE_STAFF';
export type OrderStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';
export type OrderPriority = 'STANDARD' | 'URGENT' | 'EMERGENCY';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'ACH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT';
export type StockHealth = 'OK' | 'LOW' | 'CRITICAL' | 'OUT';
export type StockMovementType =
  | 'RECEIPT'
  | 'CONSUMPTION'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'WASTAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';
export type ExpenseCategory =
  | 'SUPPLIES'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'PAYROLL'
  | 'RENT'
  | 'LOGISTICS'
  | 'OTHER';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Store {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsStoreId?: string | null;
  code: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  manager?: User | string | null;
  priceList?: PriceList | string | null;
  timezone: string;
  currency: string;
  isActive: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  store?: Store | string | null;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface Department {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsDepartmentId?: string | null;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface PriceList {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsPriceListId?: string | null;
  department: Department | string;
  isDefaultForStore: boolean;
  description?: string;
  isActive: boolean;
}

export interface Service {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsServiceId?: string | null;
  department: Department | string;
  /** A service belongs to several price lists. */
  priceLists: (PriceList | string)[];
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsCategoryId?: string | null;
  service: Service | string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Tax {
  name: string;
  percentage: number;
}

export interface Product {
  _id: string;
  name: string;
  /** Id on the turns backend, when this row mirrors one. */
  turnsProductId?: string | null;
  code: string;
  shortCode?: string;
  description?: string;
  image?: string;
  department: Department | string;
  priceList: PriceList | string;
  service: Service | string;
  category?: Category | string | null;
  basePrice: number;
  /** A material is bought as a pack: packSize + unit, e.g. 5 L. */
  packSize: number;
  unit: string;
  taxes: Tax[];
  defaultReorderThreshold: number;
  defaultCriticalThreshold: number;
  isActive: boolean;
}

export interface StoreItem {
  _id: string;
  store: Store | string;
  product: Product;
  price?: number | null;
  isAvailable: boolean;
  quantityOnHand: number;
  reorderThreshold: number;
  criticalThreshold: number;
  avgDailyUsage: number;
  stockHealth: StockHealth;
  daysOfCover: number | null;
  lastRestockedAt?: string | null;
  notes?: string;
}

export interface OrderItem {
  product: string;
  name: string;
  code: string;
  unit: string;
  packSize: number;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  taxAmount: number;
  lineTotal: number;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  by?: User | string | null;
  note?: string;
}

export type OrderActivityType = 'PAYMENT_RECORDED' | 'PAYMENT_UPDATED' | 'PAYMENT_DELETED';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

/** Audit trail of money movements, separate from the order's status timeline. */
export interface OrderActivity {
  type: OrderActivityType;
  at: string;
  by?: User | string | null;
  reference?: string;
  payment?: string | null;
  changes: FieldChange[];
  note?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  store: Store;
  placedBy: User;
  placedByAdmin: boolean;
  status: OrderStatus;
  priority: OrderPriority;
  items: OrderItem[];
  subtotal: number;
  taxTotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  requestedDeliveryDate?: string | null;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  notes?: string;
  approvedBy?: User | null;
  approvedAt?: string | null;
  rejectionReason?: string;
  fulfilledAt?: string | null;
  timeline: OrderEvent[];
  activity: OrderActivity[];
  createdAt: string;
}

export interface Payment {
  _id: string;
  reference: string;
  order: Pick<Order, '_id' | 'orderNumber' | 'total' | 'status'> | string;
  store: Store | string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt?: string | null;
  dueDate?: string | null;
  transactionId?: string;
  /** Base64 data URL; only returned on the payment detail. */
  receiptImage?: string;
  isOverdue: boolean;
  notes?: string;
  createdAt: string;
}

export interface StockMovement {
  _id: string;
  store: Store | string;
  product: Product;
  type: StockMovementType;
  quantity: number;
  delta: number;
  balanceAfter: number;
  order?: string | null;
  performedBy: User | string;
  note?: string;
  occurredAt: string;
}

export interface Expense {
  _id: string;
  store: Store | string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  incurredAt: string;
  vendor?: string;
  method: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

/* ---- catalog tree (Department > PriceList > Service > Category? > Product) ---- */

export interface TreeProduct {
  id: string;
  name: string;
  code: string;
  image?: string;
  basePrice: number;
  price: number;
  packSize: number;
  unit: string;
  taxes: Tax[];
  storeItem?: {
    id: string;
    isAvailable: boolean;
    quantityOnHand: number;
    reorderThreshold: number;
    criticalThreshold: number;
    stockHealth: StockHealth;
  } | null;
}

export interface TreeCategory {
  categoryId: string;
  categoryName: string;
  description?: string;
  products: TreeProduct[];
}

export interface TreeService {
  serviceId: string;
  serviceName: string;
  categories: TreeCategory[];
  /** Products with no category. */
  products: TreeProduct[];
}

export interface TreePriceList {
  priceListId: string;
  priceListName: string;
  isDefaultForStore: boolean;
  department: Department;
  services: TreeService[];
}

export interface StatsOverview {
  activeStores: number;
  openOrders: number;
  pendingApproval: number;
  itemsAtRisk: number;
  storesAtRisk: number;
  outstandingAmount: number;
  outstandingOrders: number;
  expensesThisMonth: number;
}

export interface ReorderRow {
  storeItemId: string;
  store: Store;
  product: Product;
  quantityOnHand: number;
  avgDailyUsage: number;
  daysOfCover: number | null;
  stockHealth: StockHealth;
  suggestedQuantity: number;
  depletionDate: string | null;
}
