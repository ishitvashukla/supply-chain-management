import { ROLES } from '../constants';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import { createCrudService, type ListParams } from './crud.factory';

const base = createCrudService(User, {
  searchFields: ['name', 'email'],
  populate: [{ path: 'store', select: 'name code' }],
  label: 'User',
});

export const userService = {
  ...base,

  list(params: ListParams = {}) {
    return base.list(params);
  },

  /** Password changes go through auth.changePassword, never a bare update. */
  async update(id: string, payload: Record<string, unknown>) {
    if ('password' in payload) {
      throw ApiError.badRequest('Use the change-password endpoint to update a password');
    }
    return base.update(id, payload);
  },

  async deactivate(id: string) {
    return base.update(id, { isActive: false } as never);
  },

  async remove(id: string) {
    const admins = await User.countDocuments({ role: ROLES.ADMIN, isActive: true });
    const target = await User.findById(id);
    if (!target) throw ApiError.notFound('User not found');
    // Locking everyone out of the admin surface is not a recoverable mistake.
    if (target.role === ROLES.ADMIN && admins <= 1) {
      throw ApiError.badRequest('Cannot delete the last active admin');
    }
    return base.remove(id);
  },
};

export default userService;
