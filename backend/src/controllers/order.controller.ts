import type { Request, Response } from 'express';
import { ORDER_STATUS, ROLES, STORE_ROLES, type OrderStatus } from '../constants';
import { optionalStoreScope, resolveStoreScope } from '../middlewares/auth';
import orderService from '../services/order.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

/**
 * Both directions of the two-way flow land here: a store user ordering for
 * itself, and an admin ordering on a store's behalf. `resolveStoreScope`
 * decides which store the order belongs to.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const storeId = resolveStoreScope(req, req.body.store);
  const order = await orderService.create(
    { ...req.body, store: storeId },
    { id: req.user.id, role: req.user.role },
  );
  return sendSuccess(res, { statusCode: 201, message: 'Order created', data: order });
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, paymentStatus, storeId, search, from, to } =
    req.query as Record<string, never>;
  const scopedStore = optionalStoreScope(req, storeId);
  const { items, meta } = await orderService.list({
    page,
    limit,
    status,
    paymentStatus,
    search,
    from,
    to,
    store: scopedStore,
  });
  return sendSuccess(res, { message: 'Orders fetched', data: items, meta });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getById(req.params.id as string);
  // Populated store — compare on its id.
  resolveStoreScope(req, String(order.store?._id ?? order.store));
  return sendSuccess(res, { message: 'Order fetched', data: order });
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const existing = await orderService.getById(req.params.id as string);
  resolveStoreScope(req, String(existing.store?._id ?? existing.store));
  const order = await orderService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Order updated', data: order });
});

/**
 * Statuses a store user may set on its own order: it can submit a draft and
 * cancel, but approving or fulfilling its own request is an admin decision.
 */
const STORE_ALLOWED_STATUSES: OrderStatus[] = [ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED];

/** Approve / reject / fulfil / cancel — all guarded by the transition table. */
export const transitionOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const existing = await orderService.getById(req.params.id as string);
  resolveStoreScope(req, String(existing.store?._id ?? existing.store));

  const { status, note, reason } = req.body as {
    status: OrderStatus;
    note?: string;
    reason?: string;
  };

  if (STORE_ROLES.includes(req.user.role) && !STORE_ALLOWED_STATUSES.includes(status)) {
    throw ApiError.forbidden(
      `Only an ${ROLES.ADMIN} can set an order to ${status}. ` +
        `You can set: ${STORE_ALLOWED_STATUSES.join(', ')}`,
    );
  }

  const order = await orderService.transition(
    req.params.id as string,
    status,
    { id: req.user.id },
    { note, reason },
  );
  return sendSuccess(res, { message: `Order ${status.toLowerCase()}`, data: order });
});

export const pendingApproval = asyncHandler(async (req: Request, res: Response) => {
  const storeId = optionalStoreScope(req, req.query.storeId as string | undefined);
  const orders = await orderService.pendingApproval(storeId);
  return sendSuccess(res, { message: 'Orders awaiting approval', data: orders });
});
