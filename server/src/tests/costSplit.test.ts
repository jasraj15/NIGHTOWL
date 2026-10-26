import { describe, it, expect } from 'vitest';
import { calculateProportionalCostSplit } from '../services/costSplitService.js';

describe('Cost Split Service - Proportional Allocation & Exact Rounding', () => {
  it('should split shared delivery fee proportionally to item subtotals', () => {
    const participants = [
      { userId: 'user-1', itemSubtotal: 300 },
      { userId: 'user-2', itemSubtotal: 100 },
    ];
    // deliveryFee = 40. 300 is 75%, 100 is 25%.
    // user-1 fee should be 30, user-2 fee should be 10.
    const result = calculateProportionalCostSplit(participants, 40, 0);

    expect(result.itemsSubtotal).toBe(400);
    expect(result.totalSharedFees).toBe(40);
    expect(result.finalPayableAmount).toBe(440);

    const u1 = result.splits.find((s) => s.userId === 'user-1')!;
    const u2 = result.splits.find((s) => s.userId === 'user-2')!;

    expect(u1.allocatedFee).toBe(30);
    expect(u1.totalDue).toBe(330);

    expect(u2.allocatedFee).toBe(10);
    expect(u2.totalDue).toBe(110);

    // Exact sum verification
    const sumAllocated = result.splits.reduce((sum, s) => sum + s.allocatedFee, 0);
    expect(sumAllocated).toBe(40);

    const sumTotalDue = result.splits.reduce((sum, s) => sum + s.totalDue, 0);
    expect(sumTotalDue).toBe(440);
  });

  it('should handle odd rounding remainders deterministically so sum matches final total down to the paisa', () => {
    // 3 participants with odd amounts: 123, 237, 341. Total = 701.
    // Delivery fee = 25, Other charges = 13. Shared fee = 38.
    const participants = [
      { userId: 'u1', itemSubtotal: 123 },
      { userId: 'u2', itemSubtotal: 237 },
      { userId: 'u3', itemSubtotal: 341 },
    ];

    const result = calculateProportionalCostSplit(participants, 25, 13);

    expect(result.itemsSubtotal).toBe(701);
    expect(result.totalSharedFees).toBe(38);
    expect(result.finalPayableAmount).toBe(739);

    const sumAllocated = Math.round(
      result.splits.reduce((sum, s) => sum + s.allocatedFee, 0) * 100
    ) / 100;
    expect(sumAllocated).toBe(38);

    const sumTotalDue = Math.round(
      result.splits.reduce((sum, s) => sum + s.totalDue, 0) * 100
    ) / 100;
    expect(sumTotalDue).toBe(739);
  });

  it('should reconcile to an explicit finalPayableAmount override from the retailer receipt', () => {
    const participants = [
      { userId: 'u1', itemSubtotal: 200 },
      { userId: 'u2', itemSubtotal: 200 },
    ];
    // Final payable is 450 (i.e. 50 extra in charges/taxes)
    const result = calculateProportionalCostSplit(participants, 0, 0, 450);

    expect(result.itemsSubtotal).toBe(400);
    expect(result.finalPayableAmount).toBe(450);
    expect(result.totalSharedFees).toBe(50);

    const sumDue = result.splits.reduce((sum, s) => sum + s.totalDue, 0);
    expect(sumDue).toBe(450);
  });
});
