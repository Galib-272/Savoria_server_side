import { Response } from 'express';
import { User } from '../models/User.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { UserRole } from '../types/index.js';

const CREATABLE_ROLES: UserRole[] = ['manager', 'cashier', 'kitchen', 'waiter', 'delivery'];
/** Roles a manager is allowed to manage (everything below manager) */
const MANAGER_MANAGEABLE: UserRole[] = ['cashier', 'kitchen', 'waiter', 'delivery'];
const STAFF_STATUSES = ['active', 'inactive', 'suspended', 'on_leave'];

export const getStaffMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, status } = req.query;
    const filter: any = { role: { $ne: 'customer' } };

    if (role && role !== 'customer') filter.role = String(role);
    if (status) filter.status = String(status);

    const staff = await User.find(filter).select('-password').sort({ createdAt: -1 });

    const formattedStaff = staff.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      email: s.email,
      phone: s.phone || '',
      role: s.role,
      status: s.status,
      joinDate: s.joinDate,
      avatar: s.avatar,
      assignedManager: s.assignedManager,
      isMainAdmin: s.isMainAdmin,
      permissions: s.permissions || [],
    }));

    res.status(200).json({ success: true, count: formattedStaff.length, data: formattedStaff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStaffMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role, assignedManager, permissions } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'Name, email, password, and role are required.' });
      return;
    }

    if (role === 'admin') {
      res.status(400).json({
        success: false,
        message: 'System restriction: Creating additional Admin accounts is strictly prohibited.',
      });
      return;
    }
    if (!CREATABLE_ROLES.includes(role)) {
      res.status(400).json({ success: false, message: `Invalid staff role "${role}".` });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    // Constraint: Maintain exactly 10 Waiter accounts
    if (role === 'waiter') {
      const waiterCount = await User.countDocuments({ role: 'waiter' });
      if (waiterCount >= 10) {
        res.status(400).json({
          success: false,
          message: 'System limit: Exactly 10 Waiter accounts are maintained in this restaurant. Cannot add more.',
        });
        return;
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'A user with this email already exists.' });
      return;
    }

    const newStaff = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role,
      status: 'active',
      isMainAdmin: false,
      assignedManager: assignedManager || req.user?.name,
      permissions: req.user?.isMainAdmin && Array.isArray(permissions) ? permissions : [],
      joinDate: new Date().toISOString().split('T')[0],
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      action: 'CREATE_STAFF',
      entity: 'Staff',
      entityId: newStaff._id.toString(),
      details: `Created new staff member: ${newStaff.name} with role ${newStaff.role}`,
    });

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        status: newStaff.status,
        joinDate: newStaff.joinDate,
        assignedManager: newStaff.assignedManager,
        permissions: newStaff.permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStaffMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, role, status, assignedManager, permissions } = req.body;

    const staff = await User.findById(id);
    if (!staff || staff.role === 'customer') {
      res.status(404).json({ success: false, message: 'Staff member not found.' });
      return;
    }

    const actorIsManager = req.user?.role === 'manager' && !req.user?.isMainAdmin;
    if (actorIsManager) {
      if (!MANAGER_MANAGEABLE.includes(staff.role)) {
        res.status(403).json({ success: false, message: 'Managers can only manage cashier, kitchen, waiter and delivery staff.' });
        return;
      }
      if (role && !MANAGER_MANAGEABLE.includes(role)) {
        res.status(403).json({ success: false, message: 'Managers cannot promote staff to manager or admin.' });
        return;
      }
      if (permissions !== undefined) {
        res.status(403).json({ success: false, message: 'Only the Main Admin can change permissions.' });
        return;
      }
    }
    if (status && !STAFF_STATUSES.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }
    if (role && !CREATABLE_ROLES.includes(role) && !(staff.isMainAdmin && role === 'admin')) {
      res.status(400).json({ success: false, message: `Invalid staff role "${role}".` });
      return;
    }

    if (staff.isMainAdmin) {
      if (role && role !== 'admin') {
        res.status(403).json({ success: false, message: 'Cannot change Main Admin role.' });
        return;
      }
      if (status && status !== 'active') {
        res.status(403).json({ success: false, message: 'Cannot deactivate or suspend Main Admin.' });
        return;
      }
    }

    if (name) staff.name = name;
    if (phone !== undefined) staff.phone = phone;
    if (assignedManager !== undefined) staff.assignedManager = assignedManager;
    if (permissions !== undefined && Array.isArray(permissions)) staff.permissions = permissions;
    if (status) staff.status = status;

    if (role && role !== staff.role) {
      if (role === 'admin') {
        res.status(400).json({ success: false, message: 'Cannot promote staff to Admin.' });
        return;
      }
      if (role === 'waiter') {
        const waiterCount = await User.countDocuments({ role: 'waiter' });
        if (waiterCount >= 10) {
          res.status(400).json({ success: false, message: 'Cannot have more than 10 Waiters.' });
          return;
        }
      }
      staff.role = role;
    }

    await staff.save();

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'admin',
      action: 'UPDATE_STAFF',
      entity: 'Staff',
      entityId: staff._id.toString(),
      details: `Updated staff ${staff.name} (status: ${staff.status}, role: ${staff.role})`,
    });

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        status: staff.status,
        permissions: staff.permissions,
        assignedManager: staff.assignedManager,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStaffMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const staff = await User.findById(id);
    if (!staff || staff.role === 'customer') {
      res.status(404).json({ success: false, message: 'Staff member not found.' });
      return;
    }

    if (staff.isMainAdmin) {
      res.status(403).json({ success: false, message: 'Protected: The Main Admin account can NEVER be deleted.' });
      return;
    }
    if (staff._id.toString() === req.user?.userId) {
      res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
      return;
    }

    await User.findByIdAndDelete(id);

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      action: 'DELETE_STAFF',
      entity: 'Staff',
      entityId: id,
      details: `Deleted staff member: ${staff.name} (${staff.email})`,
    });

    res.status(200).json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
