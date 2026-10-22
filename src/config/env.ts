import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const PUBLISHED_EXAMPLE_SECRET = 'super_secret_jwt_key_savoria_rms_2026';

const resolveJwtSecret = (): string => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv !== PUBLISHED_EXAMPLE_SECRET) return fromEnv;
  if (fromEnv === PUBLISHED_EXAMPLE_SECRET) {
    console.warn(
      '[Security] JWT_SECRET is still the public example value. Set a private random value in .env (anyone could forge logins otherwise).'
    );
    return fromEnv;
  }
  console.warn('[Security] JWT_SECRET missing — using a random per-process secret (all users must sign in again after restart).');
  return crypto.randomBytes(48).toString('hex');
};

const parseList = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rms_db',
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  /** Extra allowed front-end origins (comma separated), e.g. a deployed Netlify URL */
  CLIENT_URLS: parseList(process.env.CLIENT_URLS),
  RESTAURANT_TIMEZONE: process.env.RESTAURANT_TIMEZONE || 'Asia/Dhaka',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  MAIN_ADMIN_EMAIL: process.env.MAIN_ADMIN_EMAIL || 'admin@savoria.com',
  MAIN_ADMIN_PASSWORD: process.env.MAIN_ADMIN_PASSWORD || 'Admin@123456',
  MANAGER_EMAIL: process.env.MANAGER_EMAIL || 'manager@savoria.com',
  MANAGER_PASSWORD: process.env.MANAGER_PASSWORD || 'Manager@123456',
};

/** Origins allowed to call the API / open a socket. Any localhost port is allowed during development. */
export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true; // same-origin, curl, server-to-server
  // While developing, allow any origin (localhost, 127.0.0.1, your LAN IP from a phone, etc.)
  if (ENV.NODE_ENV !== 'production') return true;
  const allowed = [ENV.CLIENT_URL, ...ENV.CLIENT_URLS].map((u) => u.replace(/\/+$/, ''));
  return allowed.includes(origin.replace(/\/+$/, ''));
};
