import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ENV } from '../config/env.js';
import { verifyGoogleIdToken } from '../config/google.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { notify } from '../services/notification.service.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toClientUser = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  isMainAdmin: user.isMainAdmin,
  permissions: user.permissions || [],
  avatar: user.avatar,
  assignedManager: user.assignedManager,
  joinDate: user.joinDate,
});

const generateToken = (user: any): string => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isMainAdmin: user.isMainAdmin,
      permissions: user.permissions || [],
    },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN as any }
  );
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only these fields are accepted — role / status / isMainAdmin / permissions in the body are ignored,
    // so a self-registered account is ALWAYS a customer, even if it uses a staff-looking email.
    const { name, email, password, phone, avatar } = req.body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim()) {
      res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
      return;
    }
    if (!EMAIL_RX.test(email.trim())) {
      res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    // New registrations from public are always 'customer'
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: typeof phone === 'string' ? phone.trim() : undefined,
      avatar: avatar || undefined,
      role: 'customer',
      status: 'active',
      isMainAdmin: false,
    });

    const token = generateToken(user);

    await AuditLog.create({
      userId: user._id.toString(),
      userName: user.name,
      userRole: 'customer',
      action: 'REGISTER',
      entity: 'User',
      entityId: user._id.toString(),
      details: `Customer registered with email ${user.email}`,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: toClientUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended' || user.status === 'inactive') {
      res.status(403).json({ success: false, message: `Your account is ${user.status}. Please contact the administrator.` });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      token,
      user: toClientUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      res.status(400).json({ success: false, message: 'Google credential/idToken is required.' });
      return;
    }

    if (!ENV.GOOGLE_CLIENT_ID) {
      res.status(503).json({ success: false, message: 'Google sign-in is not configured on the server.' });
      return;
    }

    const googleData = await verifyGoogleIdToken(tokenToVerify);
    if (!googleData.emailVerified) {
      res.status(401).json({ success: false, message: 'Your Google email address is not verified.' });
      return;
    }

    let user = await User.findOne({ email: googleData.email.toLowerCase() });

    if (user) {
      if (user.status === 'suspended' || user.status === 'inactive') {
        res.status(403).json({ success: false, message: `Your account is ${user.status}.` });
        return;
      }
      // Restaurant staff accounts use their fixed email + password only
      if (user.role !== 'customer') {
        res.status(403).json({ success: false, message: 'Staff accounts must sign in with email and password.' });
        return;
      }
      if (!user.googleId) {
        user.googleId = googleData.googleId;
        if (!user.avatar && googleData.picture) {
          user.avatar = googleData.picture;
        }
        await user.save();
      }
    } else {
      // Create new customer with Google credentials
      user = await User.create({
        name: googleData.name,
        email: googleData.email.toLowerCase(),
        googleId: googleData.googleId,
        avatar: googleData.picture,
        role: 'customer',
        status: 'active',
        isMainAdmin: false,
      });

      await AuditLog.create({
        userId: user._id.toString(),
        userName: user.name,
        userRole: 'customer',
        action: 'GOOGLE_REGISTER',
        entity: 'User',
        entityId: user._id.toString(),
        details: `Customer registered via Google with email ${user.email}`,
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token,
      user: toClientUser(user),
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: `Google authentication failed: ${error.message}`,
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: toClientUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { name, phone, avatar, password } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, message: 'Name cannot be empty.' });
        return;
      }
      user.name = name.trim();
    }
    if (phone !== undefined) {
      user.phone = typeof phone === 'string' ? phone.trim() : '';
    }
    if (avatar !== undefined) {
      user.avatar = avatar;
    }
    if (password !== undefined && password !== '') {
      if (user.role !== 'customer') {
        res.status(403).json({ success: false, message: 'Staff passwords are fixed by the restaurant and cannot be changed here.' });
        return;
      }
      if (typeof password !== 'string' || password.trim().length < 6) {
        res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        return;
      }
      user.password = password.trim();
    }
    if (typeof avatar === 'string' && avatar && !/^https?:\/\//i.test(avatar) && !avatar.startsWith('data:image/')) {
      res.status(400).json({ success: false, message: 'Avatar must be an image URL.' });
      return;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: toClientUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Demo "forgot password": there is no email service, so the request is forwarded to the Main Admin
 * as a notification. The response is the same whether or not the email exists.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    if (!EMAIL_RX.test(email)) {
      res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      return;
    }
    const user = await User.findOne({ email });
    if (user) {
      await notify({
        title: 'Password Reset Requested',
        message: `${user.name} (${user.email}, ${user.role}) asked for a password reset.`,
        type: 'system',
        roles: ['admin'],
        includeManagement: false,
      });
    }
    res.status(200).json({
      success: true,
      message: 'If an account exists for this email, the restaurant admin has been notified and will help you reset it.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
