import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rms_db',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_savoria_rms_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  MAIN_ADMIN_EMAIL: process.env.MAIN_ADMIN_EMAIL || 'admin@savoria.com',
  MAIN_ADMIN_PASSWORD: process.env.MAIN_ADMIN_PASSWORD || 'Admin@123456',
  MANAGER_EMAIL: process.env.MANAGER_EMAIL || 'manager@savoria.com',
  MANAGER_PASSWORD: process.env.MANAGER_PASSWORD || 'Manager@123456',
};
