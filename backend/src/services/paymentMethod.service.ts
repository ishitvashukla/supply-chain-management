import { PAYMENT_METHOD_VALUES } from '../constants';
import Payment from '../models/payment.model';
import PaymentMethodModel, { type IPaymentMethod } from '../models/paymentMethod.model';
import ApiError from '../utils/ApiError';
import { createCrudService } from './crud.factory';

const base = createCrudService(PaymentMethodModel, {
  searchFields: ['name', 'code'],
  defaultSort: 'sortOrder name',
  label: 'Payment method',
});

const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Creates the built-in methods on first use, so an empty install still has
 * something to pick and existing payments keep resolving to a known method.
 */
export const ensureDefaultMethods = async (): Promise<void> => {
  const count = await PaymentMethodModel.estimatedDocumentCount();
  if (count > 0) return;

  await PaymentMethodModel.insertMany(
    PAYMENT_METHOD_VALUES.map((code, index) => ({
      name: titleCase(code),
      code,
      sortOrder: index,
      isSystem: true,
    })),
  );
};

export const paymentMethodService = {
  ...base,

  async list(params: Parameters<typeof base.list>[0] = {}) {
    await ensureDefaultMethods();
    return base.list(params);
  },

  async create(payload: Partial<IPaymentMethod>) {
    const code = payload.code?.trim().toUpperCase();
    if (!code) throw ApiError.badRequest('code is required');

    const clash = await PaymentMethodModel.findOne({ code });
    if (clash) throw ApiError.conflict(`A payment method with code ${code} already exists`);

    return base.create({ ...payload, code, isSystem: false });
  },

  /** The code is what payments reference, so it can never be edited. */
  async update(id: string, payload: Partial<IPaymentMethod>) {
    const { code: _ignored, isSystem: _system, ...safe } = payload;
    return base.update(id, safe);
  },

  async remove(id: string) {
    const method = await PaymentMethodModel.findById(id);
    if (!method) throw ApiError.notFound('Payment method not found');

    if (method.isSystem) {
      throw ApiError.badRequest('Built-in methods cannot be deleted — deactivate it instead');
    }

    // Deleting a method still referenced by payments would orphan their history.
    const used = await Payment.countDocuments({ method: method.code } as never);
    if (used > 0) {
      throw ApiError.conflict(
        `${used} payment(s) use this method; deactivate it instead of deleting`,
      );
    }

    return base.remove(id);
  },
};

export default paymentMethodService;
