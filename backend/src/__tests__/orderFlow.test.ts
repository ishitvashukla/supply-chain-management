import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ORDER_STATUS, ROLES } from '../constants';
import Department from '../models/department.model';
import PriceList from '../models/priceList.model';
import Product from '../models/product.model';
import Service from '../models/service.model';
import Store from '../models/store.model';
import StoreItem from '../models/storeItem.model';
import User from '../models/user.model';
import orderService from '../services/order.service';
import { clearTestDb, startTestDb, stopTestDb } from './setup';
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

/** Builds the minimum catalog an order needs. */
const seedCatalog = async () => {

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
    packSize: 5,
    unit: 'L',
    taxes: [{ name: 'Tax', percentage: 10 }],
  });
  await StoreItem.create({ store: store._id, product: product._id, quantityOnHand: 0 });

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.local',
    password: 'Password123',
    role: ROLES.ADMIN,
  });

  return { store, product, admin, service, priceList };
};

describe('order state machine', () => {
  it('prices a line from the store price, including tax', async () => {
    const { store, product, admin } = await seedCatalog();

    const order = await orderService.create(
      { store: String(store._id), items: [{ product: String(product._id), quantity: 2 }] },
      { id: String(admin._id), role: ROLES.ADMIN },
    );

    expect(order.subtotal).toBe(200);
    expect(order.taxTotal).toBe(20);
    expect(order.total).toBe(220);
    // The line snapshots the pack so later catalog edits can't rewrite history.
    expect(order.items[0]!.packSize).toBe(5);
    expect(order.items[0]!.unit).toBe('L');
  });

  it('refuses a transition that is not allowed', async () => {
    const { store, product, admin } = await seedCatalog();

    const order = await orderService.create(
      { store: String(store._id), items: [{ product: String(product._id), quantity: 1 }] },
      { id: String(admin._id), role: ROLES.ADMIN },
    );

    await expect(
      orderService.transition(String(order._id), ORDER_STATUS.FULFILLED, { id: String(admin._id) }),
    ).rejects.toThrow(/Cannot move an order from DRAFT to FULFILLED/);
  });

  it('receives stock into the store when an order is fulfilled', async () => {
    const { store, product, admin } = await seedCatalog();

    const order = await orderService.create(
      {
        store: String(store._id),
        items: [{ product: String(product._id), quantity: 7 }],
        submit: true,
      },
      { id: String(admin._id), role: ROLES.ADMIN },
    );

    await orderService.transition(String(order._id), ORDER_STATUS.APPROVED, {
      id: String(admin._id),
    });
    await orderService.transition(String(order._id), ORDER_STATUS.FULFILLED, {
      id: String(admin._id),
    });

    const item = await StoreItem.findOne({ store: store._id, product: product._id });
    expect(item?.quantityOnHand).toBe(7);
  });
});
