import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../constants';
import Department from '../models/department.model';
import Order from '../models/order.model';
import PriceList from '../models/priceList.model';
import Product from '../models/product.model';
import Service from '../models/service.model';
import Store from '../models/store.model';
import User from '../models/user.model';
import orderService from '../services/order.service';
import paymentService from '../services/payment.service';
import { ensureDefaultMethods } from '../services/paymentMethod.service';
import { asTenant, clearTestDb, startTestDb, stopTestDb } from './setup';
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const seedOrder = async () => {

  await ensureDefaultMethods();

  const department = await Department.create({ name: 'Chemicals', code: 'CHEM' });
  const priceList = await PriceList.create({ name: 'Standard', department: department._id });
  const service = await Service.create({
    name: 'Detergents',
    department: department._id,
    priceLists: [priceList._id],
  });
  const store = await Store.create({ name: 'Store A', code: 'A' });
  const product = await Product.create({
    name: 'Detergent',
    code: 'DET',
    department: department._id,
    priceList: priceList._id,
    service: service._id,
    basePrice: 100,
    unit: 'L',
  });
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.local',
    password: 'Password123',
    role: ROLES.ADMIN,
  });

  const order = await orderService.create(
    { store: String(store._id), items: [{ product: String(product._id), quantity: 1 }] },
    { id: String(admin._id), role: ROLES.ADMIN },
  );

  return { order, admin };
};

describe('payments', () => {
  it('keeps the order rollup in step and refuses to overpay', asTenant(async () => {
    const { order, admin } = await seedOrder();

    await paymentService.create(
      { order: String(order._id), amount: 60, method: 'CASH' },
      String(admin._id),
    );

    const partial = await Order.findById(order._id);
    expect(partial?.amountPaid).toBe(60);
    expect(partial?.paymentStatus).toBe('PARTIAL');

    await expect(
      paymentService.create(
        { order: String(order._id), amount: 500, method: 'CASH' },
        String(admin._id),
      ),
    ).rejects.toThrow(/exceeds the balance due/);
  }));

  it('checks an edited amount against the OTHER payments, not its own old value', asTenant(async () => {
    const { order, admin } = await seedOrder();

    const payment = await paymentService.create(
      { order: String(order._id), amount: 40, method: 'CASH' },
      String(admin._id),
    );

    // 100 is the full total; allowed because this payment's own 40 is excluded.
    await paymentService.update(String(payment._id), { amount: 100 }, String(admin._id));

    const settled = await Order.findById(order._id);
    expect(settled?.amountPaid).toBe(100);
    expect(settled?.paymentStatus).toBe('PAID');
  }));

  it('records every payment change on the order with a field-level diff', asTenant(async () => {
    const { order, admin } = await seedOrder();

    const payment = await paymentService.create(
      { order: String(order._id), amount: 20, method: 'CASH' },
      String(admin._id),
    );
    await paymentService.update(
      String(payment._id),
      { amount: 30, method: 'CARD' },
      String(admin._id),
    );

    const withTrail = await Order.findById(order._id);
    const updated = withTrail?.activity.find((a) => a.type === 'PAYMENT_UPDATED');

    expect(withTrail?.activity[0]?.type).toBe('PAYMENT_RECORDED');
    expect(updated?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'amount', from: '20', to: '30' }),
        expect.objectContaining({ field: 'method', from: 'CASH', to: 'CARD' }),
      ]),
    );
  }));

  it('rejects a payment method that does not exist', asTenant(async () => {
    const { order, admin } = await seedOrder();

    await expect(
      paymentService.create(
        { order: String(order._id), amount: 10, method: 'BITCOIN' },
        String(admin._id),
      ),
    ).rejects.toThrow(/Unknown payment method/);
  }));
});
