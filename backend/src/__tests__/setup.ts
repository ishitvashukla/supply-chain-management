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
