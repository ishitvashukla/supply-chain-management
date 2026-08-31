import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 8000,
  mongoUri: requireEnv('MONGO_URI'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '3d',
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  /**
   * Grace window in which a just-rotated refresh token is still accepted.
   * Without it, two tabs refreshing at the same moment would look like token
   * theft and log the user out.
   */
  refreshGraceSeconds: Number(process.env.REFRESH_GRACE_SECONDS ?? 30),
  /** Multi-tenant turns base, with {BUSINESS_ID} substituted per request. */
  turnsBaseUrl: process.env.TURNS_BASE_URL ?? 'https://{BUSINESS_ID}.turnsapp.com/',
  /** The turns API rejects requests that omit these app identity headers. */
  turnsAppName: process.env.TURNS_APP_NAME ?? '1.0.0.0',
  turnsAppVersion: process.env.TURNS_APP_VERSION ?? '10000',
  turnsOsVersion: process.env.TURNS_OS_VERSION ?? '24',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  get isProd(): boolean {
    return this.nodeEnv === 'production';
  },
};

export default env;
