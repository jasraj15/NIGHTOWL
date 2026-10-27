import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';

/** GET /notifications?unread=true&limit=20&page=1 — only the caller's own notifications. */
export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!._id;
    const unreadOnly = req.query.unread === 'true';
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);

    const query: any = { recipient: userId };
    if (unreadOnly) query.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid notification id.' });
      return;
    }
    // Scoped to the recipient: another user's id returns 404, never 200.
    const updated = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user!._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }
    const unreadCount = await Notification.countDocuments({ recipient: req.user!._id, read: false });
    res.status(200).json({ success: true, notification: updated, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user!._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.status(200).json({ success: true, updated: result.modifiedCount, unreadCount: 0 });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid notification id.' });
      return;
    }
    const result = await Notification.deleteOne({ _id: id, recipient: req.user!._id });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
