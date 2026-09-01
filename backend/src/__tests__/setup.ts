import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo: MongoMemoryServer | undefined;

/**
 * Tests run against an in-memory MongoDB, never the real database — they
 * create and delete freely, which would be destructive against door_dev.
 */
export const startTestDb = async (): Promise<void> => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'test' });
};

export const stopTestDb = async (): Promise<void> => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
};

export const clearTestDb = async (): Promise<void> => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

import { runInTenant } from '../lib/tenantContext';

/** The franchise the non-isolation tests operate as. */
export const TEST_BUSINESS = 'test-co';

/**
 * Wraps a test so its queries are scoped, exactly as a real request is.
 * Without a franchise the models match nothing by design, so an unscoped test
 * would be testing the fail-closed path rather than the behaviour it names.
 */
export const asTenant =
  (fn: () => Promise<void>, businessId = TEST_BUSINESS) =>
  () =>
    runInTenant(businessId, fn);
