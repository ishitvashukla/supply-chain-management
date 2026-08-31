import type { Request, Response } from 'express';
import productService from '../services/product.service';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, never>;
  const { items, meta } = await productService.list(query);
  return sendSuccess(res, { message: 'Items fetched', data: items, meta });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getById(req.params.id as string);
  return sendSuccess(res, { message: 'Item fetched', data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { store, storePrice, ...payload } = req.body;
  const product = await productService.create(payload);

  // Creating an item for a store also puts it on that store's list.
  if (store) await productService.addToStore(String(product.id), store, storePrice);

  return sendSuccess(res, { statusCode: 201, message: 'Item created', data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'Item updated', data: product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.remove(req.params.id as string);
  return sendSuccess(res, { message: 'Item deleted' });
});
