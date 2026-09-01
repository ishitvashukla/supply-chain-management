import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../constants';
import { runInTenant } from '../lib/tenantContext';
import Department from '../models/department.model';
import PriceList from '../models/priceList.model';
import Product from '../models/product.model';
import Service from '../models/service.model';
import Store from '../models/store.model';
import User from '../models/user.model';
import orderService from '../services/order.service';
import { clearTestDb, startTestDb, stopTestDb } from './setup';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

/** Builds one franchise's catalog, entirely inside its own scope. */
const seedFranchise = (businessId: string, label: string) =>
  runInTenant(businessId, async () => {
    const department = await Department.create({ name: `${label} Chemicals`, code: 'CHEM' });
    const priceList = await PriceList.create({ name: 'Standard', department: department._id });
    const service = await Service.create({
      name: 'Detergents',
      department: department._id,
      priceLists: [priceList._id],
    });
    // Both franchises deliberately use the SAME codes and the same turns ids:
    // franchise A's store 68 is a different shop from franchise B's store 68.
    const store = await Store.create({ name: `${label} Store`, code: 'ALPHA', turnsStoreId: '68' });
    const product = await Product.create({
      name: `${label} Detergent`,
      code: 'DET-X300',
      turnsProductId: '173',
      department: department._id,
      priceList: priceList._id,
      service: service._id,
      basePrice: 100,
      unit: 'L',
    });
    const admin = await User.create({
      name: `${label} Admin`,
      // The same person can hold an account at both franchises.
      email: 'admin@shared.example',
      password: 'Password123',
      role: ROLES.ADMIN,
    });
    return { store, product, admin };
  });

describe('franchises cannot see each other’s data', () => {
  it('keeps identical codes and turns ids apart', async () => {
    await seedFranchise('acme', 'Acme');
    await seedFranchise('globex', 'Globex');

    const acme = await runInTenant('acme', async () => await Store.find({}));
    const globex = await runInTenant('globex', async () => await Store.find({}));

    expect(acme).toHaveLength(1);
    expect(globex).toHaveLength(1);
    expect(acme[0]!.name).toBe('Acme Store');
    expect(globex[0]!.name).toBe('Globex Store');
    // Same code and same turns id in both, which must not collide.
    expect(acme[0]!.code).toBe(globex[0]!.code);
    expect(acme[0]!.turnsStoreId).toBe(globex[0]!.turnsStoreId);
  });

  it('shows each franchise only its own items', async () => {
    await seedFranchise('acme', 'Acme');
    await seedFranchise('globex', 'Globex');

    const acmeItems = await runInTenant('acme', async () => await Product.find({}));
    const globexItems = await runInTenant('globex', async () => await Product.find({}));

    expect(acmeItems.map((p) => p.name)).toEqual(['Acme Detergent']);
    expect(globexItems.map((p) => p.name)).toEqual(['Globex Detergent']);
  });

  it('will not fetch another franchise’s record by its id', async () => {
    const acme = await seedFranchise('acme', 'Acme');
    await seedFranchise('globex', 'Globex');

    // Even holding the exact id, the other franchise sees nothing.
    const stolen = await runInTenant('globex', async () => await Product.findById(acme.product._id));
    expect(stolen).toBeNull();
  });

  it('numbers orders per franchise, not globally', async () => {
    const acme = await seedFranchise('acme', 'Acme');
    const globex = await seedFranchise('globex', 'Globex');

    const acmeOrder = await runInTenant('acme', async () =>
      orderService.create(
        { store: String(acme.store._id), items: [{ product: String(acme.product._id), quantity: 1 }] },
        { id: String(acme.admin._id), role: ROLES.ADMIN },
      ),
    );
    const globexOrder = await runInTenant('globex', async () =>
      orderService.create(
        {
          store: String(globex.store._id),
          items: [{ product: String(globex.product._id), quantity: 1 }],
        },
        { id: String(globex.admin._id), role: ROLES.ADMIN },
      ),
    );

    // Both start at 1: a franchise's order numbers are its own.
    expect(acmeOrder.orderNumber).toBe('PO-00001');
    expect(globexOrder.orderNumber).toBe('PO-00001');
  });

  it('refuses to build an order from another franchise’s item', async () => {
    const acme = await seedFranchise('acme', 'Acme');
    const globex = await seedFranchise('globex', 'Globex');

    await expect(
      runInTenant('globex', async () =>
        orderService.create(
          {
            store: String(globex.store._id),
            items: [{ product: String(acme.product._id), quantity: 1 }],
          },
          { id: String(globex.admin._id), role: ROLES.ADMIN },
        ),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('returns nothing at all when no franchise is in scope', async () => {
    await seedFranchise('acme', 'Acme');

    // Fail-closed: an unscoped query must not quietly read everything.
    expect(await Product.find({})).toHaveLength(0);
    expect(await Store.find({})).toHaveLength(0);
  });
});
