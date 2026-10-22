import { Request, Response } from 'express';
import { Review } from '../models/Review.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { isValidObjectId } from '../utils/helpers.js';

const formatReview = (r: any) => ({
  id: r._id.toString(),
  customerName: r.customerName,
  rating: r.rating,
  comment: r.comment,
  date: r.date,
  orderId: r.orderId,
  menuItemId: r.menuItemId,
  avatar: r.avatar,
});

export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { approved: true };
    if (req.query.menuItemId && isValidObjectId(String(req.query.menuItemId))) filter.menuItemId = String(req.query.menuItemId);
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ success: true, count: reviews.length, data: reviews.map(formatReview) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Recalculate a menu item's average rating from its approved reviews */
const refreshMenuItemRating = async (menuItemId: string) => {
  const reviews = await Review.find({ menuItemId, approved: true }).select('rating').lean();
  if (reviews.length) {
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await MenuItem.findByIdAndUpdate(menuItemId, { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length });
  }
};

export const createReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { comment, orderId, menuItemId, avatar } = req.body;
    const rating = Number(req.body.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || !comment.trim()) {
      res.status(400).json({ success: false, message: 'A rating (1–5) and a comment are required.' });
      return;
    }
    if (comment.length > 1000) {
      res.status(400).json({ success: false, message: 'Comment is too long (max 1000 characters).' });
      return;
    }
    if (menuItemId && !(isValidObjectId(menuItemId) && (await MenuItem.exists({ _id: menuItemId })))) {
      res.status(400).json({ success: false, message: 'Unknown menu item.' });
      return;
    }

    const review = await Review.create({
      customerName: req.user!.name, // always the signed-in customer's own name
      customerId: req.user!.userId,
      rating,
      comment: comment.trim(),
      orderId,
      menuItemId: menuItemId || undefined,
      avatar: typeof avatar === 'string' && /^https?:\/\//i.test(avatar) ? avatar : undefined,
      approved: true,
    });

    if (review.menuItemId) await refreshMenuItemRating(review.menuItemId);

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: formatReview(review) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
