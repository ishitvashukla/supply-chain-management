import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

mongoose.set('strictQuery', true);

export const connectDB = async (): Promise<typeof mongoose> => {
  mongoose.connection.on('error', (err: Error) => logger.error(`MongoDB error: ${err.message}`));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  const conn = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
  });

  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close(false);
};
