import type { Request, Response } from 'express';
import userService from '../services/user.service';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, sort } = req.query as Record<string, never>;
  const { items, meta } = await userService.list({ page, limit, search, sort });
  return sendSuccess(res, { message: 'Users fetched', data: items, meta });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getById(req.params.id as string);
  return sendSuccess(res, { message: 'User fetched', data: user });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.update(req.params.id as string, req.body);
  return sendSuccess(res, { message: 'User updated', data: user });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.remove(req.params.id as string);
  return sendSuccess(res, { message: 'User deleted' });
});
