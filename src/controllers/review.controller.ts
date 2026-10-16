import { Request, Response } from 'express';
import { Review } from '../models/Review.model.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
    const formatted = reviews.map((r) => ({
      id: r._id.toString(),
      customerName: r.customerName,
      rating: r.rating,
      comment: r.comment,
      date: r.date,
      orderId: r.orderId,
      avatar: r.avatar,
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { customerName, rating, comment, orderId, avatar } = req.body;

    if (!rating || !comment) {
      res.status(400).json({ success: false, message: 'Rating and comment are required.' });
      return;
    }

    const review = await Review.create({
      customerName: customerName || req.user?.name || 'Customer',
      customerId: req.user?.userId,
      rating: Number(rating),
      comment,
      orderId,
      avatar: avatar || req.user?.permissions ? undefined : req.body.avatar,
      approved: true,
    });

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
