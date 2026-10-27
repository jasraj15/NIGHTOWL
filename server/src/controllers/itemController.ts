import { Request, Response, NextFunction } from 'express';
import { Pool, IPool } from '../models/Pool.js';
import { PoolItem } from '../models/PoolItem.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { addItemSchema, updateItemSchema } from '../validators/itemSchemas.js';
import { checkAndExpirePool } from '../services/poolExpiryService.js';
import { broadcastPoolUpdate, SOCKET_EVENTS } from '../services/socketService.js';
import { PUBLIC_USER_FIELDS } from '../models/User.js';

/**
 * Atomically apply a delta to the cached pool subtotal ($inc) so concurrent cart edits
 * never overwrite each other, then refresh the in-memory document with the rounded value.
 */
async function applySubtotalDelta(pool: IPool, delta: number): Promise<void> {
  const updated = await Pool.findByIdAndUpdate(
    pool._id,
    { $inc: { currentSubtotal: Math.round(delta * 100) / 100 } },
    { new: true, select: 'currentSubtotal' }
  ).lean();
  pool.currentSubtotal = Math.round(((updated?.currentSubtotal ?? 0) as number) * 100) / 100;
}

function totalPayload(pool: { _id: any; currentSubtotal: number; targetAmount: number }) {
  return {
    poolId: pool._id.toString(),
    currentSubtotal: pool.currentSubtotal,
    remainingAmount: Math.max(0, Math.round((pool.targetAmount - pool.currentSubtotal) * 100) / 100),
    progressPercent: Math.min(100, Math.round((pool.currentSubtotal / pool.targetAmount) * 100)),
  };
}

export async function addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { poolId } = req.params;
    const userId = req.user!._id;
    const data = addItemSchema.parse(req.body);

    const pool = await Pool.findById(poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    await checkAndExpirePool(pool);

    if (pool.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Cannot add items to this pool because it is ${pool.status.toLowerCase()}.`,
      });
      return;
    }

    // Membership is explicit: users must join (and confirm the delivery location) first.
    const isParticipant = pool.participants.some((p) => p.toString() === userId.toString());
    if (!isParticipant) {
      res.status(403).json({
        success: false,
        error: 'Join the pool before adding items.',
        code: 'NOT_A_PARTICIPANT',
      });
      return;
    }

    const newItemSubtotal = Math.round(data.quantity * data.unitPrice * 100) / 100;

    // Check contribution cap if set
    if (pool.contributionCap && pool.contributionCap > 0) {
      const userExistingItems = await PoolItem.find({ poolId: pool._id, userId });
      const currentContribution = userExistingItems.reduce((sum, it) => sum + it.itemSubtotal, 0);

      if (currentContribution + newItemSubtotal > pool.contributionCap) {
        res.status(400).json({
          success: false,
          error: `Adding this item would exceed the pool's individual contribution cap of ₹${pool.contributionCap}. Current contribution: ₹${currentContribution}.`,
        });
        return;
      }
    }

    const item = await PoolItem.create({
      poolId: pool._id,
      userId,
      name: data.name,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      itemSubtotal: newItemSubtotal,
      note: data.note,
    });

    await applySubtotalDelta(pool, newItemSubtotal);

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'ITEM_ADDED',
      details: {
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
      },
      ipAddress: req.ip,
    });

    const populatedItem = await PoolItem.findById(item._id).populate(
      'userId',
      PUBLIC_USER_FIELDS
    );

    broadcastPoolUpdate(pool._id.toString(), 'cart:item_added', {
      poolId: pool._id.toString(),
      item: populatedItem,
      currentSubtotal: pool.currentSubtotal,
      remainingAmount: Math.max(0, pool.targetAmount - pool.currentSubtotal),
      progressPercent: Math.min(100, Math.round((pool.currentSubtotal / pool.targetAmount) * 100)),
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.TOTAL_CHANGED, totalPayload(pool));

    res.status(201).json({
      success: true,
      message: 'Item added to pool cart.',
      item: populatedItem,
      poolSubtotal: pool.currentSubtotal,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { poolId, itemId } = req.params;
    const userId = req.user!._id;
    const data = updateItemSchema.parse(req.body);

    const pool = await Pool.findById(poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    await checkAndExpirePool(pool);

    if (pool.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Cannot modify items because this pool is ${pool.status.toLowerCase()}.`,
      });
      return;
    }

    const item = await PoolItem.findById(itemId);
    if (!item || item.poolId.toString() !== pool._id.toString()) {
      res.status(404).json({ success: false, error: 'Item not found in this pool.' });
      return;
    }

    // Permission check: only item owner can modify
    if (item.userId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'You are only authorized to edit your own items.',
      });
      return;
    }

    const updatedQty = data.quantity !== undefined ? data.quantity : item.quantity;
    const updatedPrice = data.unitPrice !== undefined ? data.unitPrice : item.unitPrice;
    const newItemSubtotal = Math.round(updatedQty * updatedPrice * 100) / 100;

    // Check contribution cap
    if (pool.contributionCap && pool.contributionCap > 0) {
      const userOtherItems = await PoolItem.find({
        poolId: pool._id,
        userId,
        _id: { $ne: item._id },
      });
      const otherContribution = userOtherItems.reduce((sum, it) => sum + it.itemSubtotal, 0);

      if (otherContribution + newItemSubtotal > pool.contributionCap) {
        res.status(400).json({
          success: false,
          error: `Updating this item exceeds the pool's individual contribution cap of ₹${pool.contributionCap}.`,
        });
        return;
      }
    }

    const previousSubtotal = item.itemSubtotal;
    item.quantity = updatedQty;
    item.unitPrice = updatedPrice;
    item.itemSubtotal = newItemSubtotal;
    if (data.name !== undefined) item.name = data.name;
    if (data.note !== undefined) item.note = data.note;
    await item.save();

    await applySubtotalDelta(pool, newItemSubtotal - previousSubtotal);

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'ITEM_UPDATED',
      details: {
        itemId: item._id,
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
      },
      ipAddress: req.ip,
    });

    const populatedItem = await PoolItem.findById(item._id).populate(
      'userId',
      PUBLIC_USER_FIELDS
    );

    broadcastPoolUpdate(pool._id.toString(), 'cart:item_updated', {
      poolId: pool._id.toString(),
      item: populatedItem,
      currentSubtotal: pool.currentSubtotal,
      remainingAmount: Math.max(0, pool.targetAmount - pool.currentSubtotal),
      progressPercent: Math.min(100, Math.round((pool.currentSubtotal / pool.targetAmount) * 100)),
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.TOTAL_CHANGED, totalPayload(pool));

    res.status(200).json({
      success: true,
      message: 'Item updated.',
      item: populatedItem,
      poolSubtotal: pool.currentSubtotal,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { poolId, itemId } = req.params;
    const userId = req.user!._id;

    const pool = await Pool.findById(poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    await checkAndExpirePool(pool);

    if (pool.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Cannot remove items because this pool is ${pool.status.toLowerCase()}.`,
      });
      return;
    }

    const item = await PoolItem.findById(itemId);
    if (!item || item.poolId.toString() !== pool._id.toString()) {
      res.status(404).json({ success: false, error: 'Item not found in this pool.' });
      return;
    }

    // Permission check: only item owner or pool owner
    const isItemOwner = item.userId.toString() === userId.toString();
    const isPoolOwner = pool.creator.toString() === userId.toString();

    if (!isItemOwner && !isPoolOwner) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to remove this item.',
      });
      return;
    }

    await PoolItem.deleteOne({ _id: item._id });

    await applySubtotalDelta(pool, -item.itemSubtotal);

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'ITEM_REMOVED',
      details: {
        itemId: item._id,
        itemName: item.name,
        removedBy: isItemOwner ? 'Item Owner' : 'Pool Creator',
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'cart:item_deleted', {
      poolId: pool._id.toString(),
      itemId: item._id.toString(),
      currentSubtotal: pool.currentSubtotal,
      remainingAmount: Math.max(0, pool.targetAmount - pool.currentSubtotal),
      progressPercent: Math.min(100, Math.round((pool.currentSubtotal / pool.targetAmount) * 100)),
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.TOTAL_CHANGED, totalPayload(pool));

    res.status(200).json({
      success: true,
      message: 'Item removed from pool cart.',
      poolSubtotal: pool.currentSubtotal,
    });
  } catch (err) {
    next(err);
  }
}
