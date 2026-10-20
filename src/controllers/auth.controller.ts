import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ENV } from '../config/env.js';
import { verifyGoogleIdToken } from '../config/google.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';

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
    const { name, email, password, phone, avatar } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    // New registrations from public are always 'customer'
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isMainAdmin: user.isMainAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Your account has been suspended.' });
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isMainAdmin: user.isMainAdmin,
        permissions: user.permissions || [],
        avatar: user.avatar,
      },
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

    const googleData = await verifyGoogleIdToken(tokenToVerify);

    let user = await User.findOne({ email: googleData.email.toLowerCase() });

    if (user) {
      if (user.status === 'suspended') {
        res.status(403).json({ success: false, message: 'Your account has been suspended.' });
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isMainAdmin: user.isMainAdmin,
        avatar: user.avatar,
      },
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
      user: {
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
      },
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

    if (name && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (phone !== undefined) {
      user.phone = typeof phone === 'string' ? phone.trim() : '';
    }
    if (avatar !== undefined) {
      user.avatar = avatar;
    }
    if (!['delivery', 'cashier', 'kitchen', 'waiter'].includes(user.role) && password && typeof password === 'string' && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isMainAdmin: user.isMainAdmin,
        avatar: user.avatar,
        joinDate: user.joinDate,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
