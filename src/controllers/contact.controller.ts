import { Request, Response } from 'express';
import { notify } from '../services/notification.service.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contact form → notification for the Main Admin and Manager (no email service in this demo). */
export const submitContactMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (!name || !EMAIL_RX.test(email) || !message) {
      res.status(400).json({ success: false, message: 'Name, a valid email and a message are required.' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
      return;
    }
    await notify({
      title: `Contact: ${subject || 'New message'}`.slice(0, 120),
      message: `${name} (${email}): ${message}`,
      type: 'system',
      roles: [],
    });
    res.status(201).json({ success: true, message: "Thanks! We've received your message and will get back to you soon." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
