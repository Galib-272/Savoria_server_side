import { OAuth2Client } from 'google-auth-library';
import { ENV } from './env.js';

export const googleAuthClient = ENV.GOOGLE_CLIENT_ID
  ? new OAuth2Client(ENV.GOOGLE_CLIENT_ID, ENV.GOOGLE_CLIENT_SECRET)
  : new OAuth2Client();

export const verifyGoogleIdToken = async (idToken: string) => {
  if (!idToken) {
    throw new Error('Google token is missing');
  }

  const audience = ENV.GOOGLE_CLIENT_ID || undefined;
  const ticket = await googleAuthClient.verifyIdToken({
    idToken,
    audience,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
    googleId: payload.sub,
    emailVerified: payload.email_verified,
  };
};
