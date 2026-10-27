import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification.js';
import { User, NotificationPreferences } from '../models/User.js';
import { emitToUser } from './socketService.js';

const PREFERENCE_KEY_BY_TYPE: Record<NotificationType, keyof NotificationPreferences | null> = {
  POOL_INVITATION: 'poolInvitations',
  PARTICIPANT_JOINED: 'someoneJoinsMyPool',
  POOL_NEARLY_FULL: 'poolNearlyFull',
  DEADLINE_APPROACHING: 'deadlineApproaching',
  PAYMENT_UPDATE: 'paymentUpdates',
  ORDER_UPDATE: 'orderUpdates',
  SYSTEM: null,
};

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  poolId?: Types.ObjectId | string;
}

/**
 * Persist a notification for each recipient (respecting their preferences) and push it live.
 * The database is the source of truth; the socket event is a hint to refetch/prepend.
 */
export async function notifyUsers(
  recipientIds: Array<Types.ObjectId | string>,
  input: NotifyInput,
  options: { excludeUserId?: Types.ObjectId | string } = {}
): Promise<number> {
  const unique = Array.from(new Set(recipientIds.map((id) => id.toString()))).filter(
    (id) => !options.excludeUserId || id !== options.excludeUserId.toString()
  );
  if (unique.length === 0) return 0;

  const users = await User.find({ _id: { $in: unique }, status: 'active' })
    .select('preferences')
    .lean();

  const prefKey = PREFERENCE_KEY_BY_TYPE[input.type];
  const allowed = users.filter((u: any) => {
    if (!prefKey) return true;
    const prefs = u.preferences?.notifications || {};
    return prefs[prefKey] !== false;
  });

  if (allowed.length === 0) return 0;

  const docs = await Notification.insertMany(
    allowed.map((u: any) => ({
      recipient: u._id,
      type: input.type,
      title: input.title,
      message: input.message,
      poolId: input.poolId ? new Types.ObjectId(input.poolId.toString()) : undefined,
      read: false,
    }))
  );

  for (const doc of docs) {
    emitToUser(doc.recipient.toString(), 'notification:new', {
      notification: {
        _id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        message: doc.message,
        poolId: doc.poolId?.toString(),
        read: false,
        createdAt: doc.createdAt,
      },
    });
  }

  return docs.length;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipient: userId, read: false });
}
