import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { AuthenticatedRequest, IUserPayload } from '../types/index.js';
import { User } from '../models/User.model.js';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as IUserPayload;

    // Verify user still exists in database and is not suspended
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, message: 'User account no longer exists.' });
      return;
    }

    if (user.status === 'suspended' || user.status === 'inactive') {
      res.status(403).json({ success: false, message: `Your account is ${user.status}. Please contact the administrator.` });
      return;
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isMainAdmin: user.isMainAdmin,
      permissions: user.permissions || [],
    };

    next();
  } catch (error: any) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
};

export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as IUserPayload;
      const user = await User.findById(decoded.userId);
      if (user && user.status !== 'suspended' && user.status !== 'inactive') {
        req.user = {
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          isMainAdmin: user.isMainAdmin,
          permissions: user.permissions || [],
        };
      }
    }
    next();
  } catch {
    next();
  }
};
