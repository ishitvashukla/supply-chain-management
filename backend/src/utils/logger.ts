import { toIso } from './date';

export const logger = {
  info: (...args: unknown[]): void => console.log(`[${toIso()}] INFO `, ...args),
  warn: (...args: unknown[]): void => console.warn(`[${toIso()}] WARN `, ...args),
  error: (...args: unknown[]): void => console.error(`[${toIso()}] ERROR`, ...args),
};

export default logger;
