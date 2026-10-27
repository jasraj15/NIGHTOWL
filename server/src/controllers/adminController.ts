import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Report } from '../models/Report.js';
import { Pool } from '../models/Pool.js';
import { User } from '../models/User.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';

const reviewReportSchema = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED']),
  moderatorNote: z.string().trim().max(300).optional(),
});

/** GET /admin/reports — moderators only (enforced by requireRole on the route). */
export async function listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'OPEN';
    const query: any = status === 'ALL' ? {} : { status };
    const reports = await Report.find(query)
      .populate('reporter', 'fullName email hostel')
      .populate('reportedUser', 'fullName email hostel')
      .populate('poolId', 'title retailer hostel status')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.status(200).json({ success: true, reports });
  } catch (err) {
    next(err);
  }
}

export async function reviewReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = reviewReportSchema.parse(req.body);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid report id.' });
      return;
    }
    const report = await Report.findByIdAndUpdate(
      id,
      { $set: { status: data.status, moderatorNote: data.moderatorNote, reviewedBy: req.user!._id, reviewedAt: new Date() } },
      { new: true }
    ).lean();
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }
    await AuditEvent.create({ poolId: report.poolId, userId: req.user!._id, action: 'REPORT_REVIEWED', details: { reportId: report._id, status: data.status } });
    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

/** GET /admin/analytics — platform-wide figures computed from persisted data only. */
export async function platformAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [users, poolsByStatus, paidAgg, lockedPools, feeAgg] = await Promise.all([
      User.countDocuments({ status: 'active', isEmailVerified: true }),
      Pool.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      PaymentRecord.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$totalDue' }, count: { $sum: 1 } } }]),
      Pool.find({ lockedAt: { $exists: true } }).select('createdAt lockedAt').lean(),
      Pool.aggregate([
        { $match: { status: { $in: ['ORDERED', 'DELIVERED'] } } },
        { $group: { _id: null, deliveryFees: { $sum: '$deliveryFee' }, pools: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of poolsByStatus) statusCounts[row._id] = row.count;
    const totalPools = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const fillTimes = lockedPools.map((p: any) => (new Date(p.lockedAt).getTime() - new Date(p.createdAt).getTime()) / 60000);

    res.status(200).json({
      success: true,
      analytics: {
        verifiedUsers: users,
        poolsCreated: totalPools,
        poolsCompleted: statusCounts.DELIVERED || 0,
        poolsByStatus: statusCounts,
        completionRatePercent: totalPools ? Math.round(((statusCounts.DELIVERED || 0) / totalPools) * 100) : null,
        avgMinutesToLock: fillTimes.length ? Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length) : null,
        verifiedPayments: { count: paidAgg[0]?.count || 0, amount: Math.round((paidAgg[0]?.total || 0) * 100) / 100 },
        deliveryFeesRecordedOnSharedOrders: Math.round((feeAgg[0]?.deliveryFees || 0) * 100) / 100,
        note: 'Delivery fees shown are the actual recorded fees on shared orders; no per-user savings are estimated.',
      },
    });
  } catch (err) {
    next(err);
  }
}
