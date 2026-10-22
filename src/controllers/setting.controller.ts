import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { getRestaurantSettings } from '../services/settings.service.js';
import { pick } from '../utils/helpers.js';

const TEXT_FIELDS = ['name', 'tagline', 'description', 'address', 'phone', 'email', 'hours', 'currency', 'logo', 'coverImage', 'primaryColor'];
const NUMBER_FIELDS = ['taxRate', 'serviceChargeRate', 'deliveryFee'];

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getRestaurantSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = { ...req.body };
    // accept the older field names the dashboard used to send
    if (body.restaurantName !== undefined && body.name === undefined) body.name = body.restaurantName;
    if (body.openingHours !== undefined && body.hours === undefined) body.hours = body.openingHours;

    const updates: Record<string, any> = pick(body, [...TEXT_FIELDS, ...NUMBER_FIELDS]);
    for (const key of NUMBER_FIELDS) {
      if (updates[key] !== undefined) {
        const n = Number(updates[key]);
        if (!Number.isFinite(n) || n < 0 || (key !== 'deliveryFee' && n > 100)) {
          res.status(400).json({ success: false, message: `${key} must be a valid number.` });
          return;
        }
        updates[key] = n;
      }
    }
    if (updates.name !== undefined && !String(updates.name).trim()) {
      res.status(400).json({ success: false, message: 'Restaurant name cannot be empty.' });
      return;
    }

    const settings = await getRestaurantSettings();
    Object.assign(settings, updates);
    await settings.save();
    res.status(200).json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
