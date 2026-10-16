import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { User } from '../models/User.model.js';

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized. Please sign in.' });
      return;
    }

    if (req.user.isMainAdmin) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`,
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized. Please sign in.' });
      return;
    }

    // Main Admin has all permissions
    if (req.user.isMainAdmin || req.user.role === 'admin') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. You lack the required permission: ${permission}`,
      });
      return;
    }

    next();
  };
};

// Enforce Main Admin Protection & prevent secondary admin creation
export const protectAdminRules = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const targetId = req.params.id || req.body.userId;
  const newRole = req.body.role;

  // Rule 1: No one (even admin) can create another admin account
  if (newRole === 'admin') {
    res.status(400).json({
      success: false,
      message: 'System violation: Only one Main Admin account can exist. Creating another Admin is strictly prohibited.',
    });
    return;
  }

  // Rule 2: If modifying an existing user, check if target is the Main Admin
  if (targetId) {
    const targetUser = await User.findById(targetId);
    if (targetUser && targetUser.isMainAdmin) {
      // Disallow deleting, suspending, or altering role of Main Admin
      if (req.method === 'DELETE') {
        res.status(403).json({
          success: false,
          message: 'System protection error: The Main Admin account cannot be deleted.',
        });
        return;
      }

      if (req.body.status && req.body.status !== 'active') {
        res.status(403).json({
          success: false,
          message: 'System protection error: The Main Admin account cannot be suspended or deactivated.',
        });
        return;
      }

      if (req.body.role && req.body.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'System protection error: The Main Admin role cannot be changed.',
        });
        return;
      }

      if (req.body.isMainAdmin === false) {
        res.status(403).json({
          success: false,
          message: 'System protection error: The Main Admin flag cannot be removed.',
        });
        return;
      }
    }
  }

  next();
};
