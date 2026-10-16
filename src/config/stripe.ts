import Stripe from 'stripe';
import { ENV } from './env.js';

export const stripeClient = ENV.STRIPE_SECRET_KEY
  ? new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-10-28.acacia' as any })
  : null;

export const isStripeConfigured = (): boolean => {
  return !!stripeClient;
};
