import { z } from 'zod';
import {
  EXPENSE_CATEGORY_VALUES,
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  ROLE_VALUES,
  STOCK_MOVEMENT_VALUES,
} from '../constants';
import { imageInput, objectId, paginationQuery } from './common.validator';

export * from './common.validator';

const optionalDate = z.coerce.date().optional();
const money = z.coerce.number().min(0);

/* ------------------------------------------------------------------ auth */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLE_VALUES as [string, ...string[]]),
  store: objectId.optional().nullable(),
  phone: z.string().trim().optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  /** Revoke every session for the account, not just this device. */
  allDevices: z.boolean().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken is required'),
});

/** Payload the client hands over after signing in to turns directly. */
export const turnsSessionSchema = z.object({
  businessId: z.string().trim().min(1, 'businessId is required'),
  accessToken: z.string().min(10, 'accessToken is required'),
  turnsUserId: z.string().trim().min(1, 'turnsUserId is required'),
  // VENDOR is intentionally absent — that login is not offered in this app.
  turnsRole: z.enum(['ADMIN', 'EMPLOYEE', 'STORE']),
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  storeId: z.string().trim().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: z.enum(ROLE_VALUES as [string, ...string[]]).optional(),
  store: objectId.nullable().optional(),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

/* ----------------------------------------------------------------- store */

const addressSchema = z.object({
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, 'Store name is required'),
  code: z.string().trim().min(2, 'Store code is required'),
  address: addressSchema.optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  manager: objectId.nullable().optional(),
  priceList: objectId.nullable().optional(),
  timezone: z.string().trim().optional(),
  currency: z.string().trim().length(3).optional(),
  isActive: z.boolean().optional(),
});

export const updateStoreSchema = createStoreSchema.partial();

/** Payload mirrored straight from the turns `store_list` response. */
export const syncStoresSchema = z.object({
  stores: z
    .array(
      z
        .object({
          store_id: z.union([z.string(), z.number()]).transform(String),
          store_name: z.string(),
        })
        // Turns returns ~45 fields per store; keep the ones we map and ignore the rest.
        .passthrough(),
    )
    .min(1, 'No stores to sync'),
});

/* --------------------------------------------------------------- catalog */

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required'),
  code: z.string().trim().min(2, 'Department code is required'),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createPriceListSchema = z.object({
  name: z.string().trim().min(2, 'Price list name is required'),
  department: objectId,
  isDefaultForStore: z.boolean().optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export const updatePriceListSchema = createPriceListSchema.partial();

/**
 * A service belongs to several price lists, so `priceLists` is the real field.
 * A single `priceList` is still accepted and folded into it — the turns tree
 * and older callers send one at a time.
 */
const serviceShape = {
  name: z.string().trim().min(2, 'Service name is required'),
  department: objectId,
  priceList: objectId.optional(),
  priceLists: z.array(objectId).optional(),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
};

const foldPriceList = <T extends { priceList?: string; priceLists?: string[] }>(value: T) => {
  const { priceList, ...rest } = value;
  const priceLists = value.priceLists ?? (priceList ? [priceList] : undefined);
  return { ...rest, ...(priceLists ? { priceLists } : {}) };
};

export const createServiceSchema = z
  .object(serviceShape)
  .refine((v) => Boolean(v.priceList ?? v.priceLists?.length), {
    message: 'A service must belong to at least one price list',
    path: ['priceLists'],
  })
  .transform(foldPriceList);

export const updateServiceSchema = z.object(serviceShape).partial().transform(foldPriceList);

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required'),
  service: objectId,
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

const taxSchema = z.object({
  name: z.string().trim().min(1),
  percentage: z.coerce.number().min(0).max(100),
  applicableOn: z.string().trim().optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Item name is required'),
  /** Optional: also add the new item to this store's list. */
  store: objectId.optional(),
  storePrice: z.coerce.number().min(0).optional(),
  code: z.string().trim().min(2, 'Item code is required'),
  shortCode: z.string().trim().optional(),
  description: z.string().trim().optional(),
  image: imageInput.optional(),
  service: objectId,
  /** Chosen in the form: a service belongs to several price lists. */
  priceList: objectId.optional(),
  category: objectId.nullable().optional(),
  basePrice: money,
  packSize: z.coerce.number().min(0).optional(),
  unit: z.string().trim().min(1).optional(),
  piece: z.string().trim().optional(),
  minPrice: money.optional(),
  minItem: z.coerce.number().min(0).optional(),
  taxes: z.array(taxSchema).optional(),
  defaultReorderThreshold: z.coerce.number().min(0).optional(),
  defaultCriticalThreshold: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateProductSchema = createProductSchema.partial();

export const productQuery = paginationQuery.extend({
  department: objectId.optional(),
  priceList: objectId.optional(),
  service: objectId.optional(),
  category: z.union([objectId, z.literal('none')]).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

/** The turns `price_list` tree, handed over for mirroring. */
export const syncCatalogSchema = z.object({
  turnsStoreId: z.union([z.string(), z.number()]).transform(String).optional(),
  priceLists: z
    .array(
      z
        .object({
          price_list_id: z.union([z.string(), z.number()]).transform(String),
          price_list_name: z.string(),
        })
        .passthrough(),
    )
    .min(1, 'No price lists to sync'),
});

export const catalogTreeQuery = z.object({
  storeId: objectId.optional(),
  priceListId: objectId.optional(),
});

/* ------------------------------------------------------------ store item */

export const createStoreItemSchema = z.object({
  product: objectId,
  price: money.nullable().optional(),
  isAvailable: z.boolean().optional(),
  reorderThreshold: z.coerce.number().min(0).optional(),
  criticalThreshold: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional(),
});

export const updateStoreItemSchema = z.object({
  price: money.nullable().optional(),
  isAvailable: z.boolean().optional(),
  reorderThreshold: z.coerce.number().min(0).optional(),
  criticalThreshold: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional(),
});

export const storeItemQuery = paginationQuery.extend({
  health: z.enum(['OK', 'LOW', 'CRITICAL', 'OUT']).optional(),
  isAvailable: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

/* ---------------------------------------------------------------- orders */

export const createOrderSchema = z.object({
  store: objectId.optional(),
  items: z
    .array(
      z.object({
        product: objectId,
        quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
      }),
    )
    .min(1, 'An order must contain at least one item'),
  priority: z.enum(ORDER_PRIORITY_VALUES as [string, ...string[]]).optional(),
  requestedDeliveryDate: optionalDate.nullable(),
  deliveryAddress: z.string().trim().optional(),
  deliveryInstructions: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  deliveryFee: money.optional(),
  discount: money.optional(),
  submit: z.boolean().optional(),
});

export const updateOrderSchema = createOrderSchema.partial().omit({ store: true });

export const transitionOrderSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES as [string, ...string[]]),
  note: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});

export const orderQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUS_VALUES as [string, ...string[]]).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES as [string, ...string[]]).optional(),
  storeId: objectId.optional(),
  from: optionalDate,
  to: optionalDate,
});

/* ------------------------------------------------------- payment methods */

export const createPaymentMethodSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  // Immutable once set: payments store this code, not a reference.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Code is required')
    .regex(/^[A-Z0-9_]+$/, 'Code may only contain letters, numbers and underscores'),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const paymentMethodQuery = paginationQuery.extend({
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

/* -------------------------------------------------------------- payments */

export const createPaymentSchema = z.object({
  order: objectId,
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  method: z.string().trim().toUpperCase().optional(),
  status: z.enum(PAYMENT_STATUS_VALUES as [string, ...string[]]).optional(),
  paidAt: optionalDate.nullable(),
  dueDate: optionalDate.nullable(),
  transactionId: z.string().trim().optional(),
  /** Screenshot or receipt, stored inline. */
  receiptImage: imageInput.optional(),
  notes: z.string().trim().optional(),
});

/** Every field optional — this is a partial edit of a recorded payment. */
export const updatePaymentSchema = z
  .object({
    amount: z.coerce.number().min(0.01, 'Amount must be greater than zero').optional(),
    method: z.string().trim().toUpperCase().optional(),
    status: z.enum(PAYMENT_STATUS_VALUES as [string, ...string[]]).optional(),
    paidAt: optionalDate.nullable(),
    dueDate: optionalDate.nullable(),
    transactionId: z.string().trim().optional(),
    receiptImage: imageInput.optional(),
    notes: z.string().trim().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

export const updatePaymentStatusSchema = z.object({
  status: z.enum(PAYMENT_STATUS_VALUES as [string, ...string[]]),
  notes: z.string().trim().optional(),
});

export const paymentQuery = paginationQuery.extend({
  storeId: objectId.optional(),
  order: objectId.optional(),
  status: z.enum(PAYMENT_STATUS_VALUES as [string, ...string[]]).optional(),
  from: optionalDate,
  to: optionalDate,
});

/* ----------------------------------------------------------------- stock */

export const createMovementSchema = z.object({
  product: objectId,
  type: z.enum(STOCK_MOVEMENT_VALUES as [string, ...string[]]),
  quantity: z.coerce.number().min(0.0001, 'Quantity must be greater than zero'),
  note: z.string().trim().optional(),
  order: objectId.nullable().optional(),
  occurredAt: optionalDate,
});

export const movementQuery = paginationQuery.extend({
  storeId: objectId.optional(),
  product: objectId.optional(),
  type: z.enum(STOCK_MOVEMENT_VALUES as [string, ...string[]]).optional(),
  from: optionalDate,
  to: optionalDate,
});

/* -------------------------------------------------------------- expenses */

export const createExpenseSchema = z.object({
  store: objectId.optional(),
  title: z.string().trim().min(2, 'Title is required'),
  category: z.enum(EXPENSE_CATEGORY_VALUES as [string, ...string[]]).optional(),
  amount: money,
  incurredAt: optionalDate,
  vendor: z.string().trim().optional(),
  method: z.string().trim().toUpperCase().optional(),
  order: objectId.nullable().optional(),
  receiptUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial().omit({ store: true });

export const expenseQuery = paginationQuery.extend({
  storeId: objectId.optional(),
  category: z.enum(EXPENSE_CATEGORY_VALUES as [string, ...string[]]).optional(),
  from: optionalDate,
  to: optionalDate,
});

/* ----------------------------------------------------------------- stats */

export const statsQuery = z.object({
  storeId: objectId.optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
