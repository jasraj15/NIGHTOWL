export interface ParticipantItemTotal {
  userId: string;
  itemSubtotal: number;
}

export interface SplitResult {
  userId: string;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  proportionPercent: number;
}

export interface CostSplitBreakdown {
  itemsSubtotal: number;
  deliveryFee: number;
  otherCharges: number;
  totalSharedFees: number;
  finalPayableAmount: number;
  splits: SplitResult[];
  allocationMethod: string;
}

/**
 * Proportional allocation of shared fees based on item subtotal,
 * with deterministic remainder distribution ensuring exact sum equality.
 */
export function calculateProportionalCostSplit(
  participantTotals: ParticipantItemTotal[],
  deliveryFee: number = 0,
  otherCharges: number = 0,
  overrideFinalPayableAmount?: number
): CostSplitBreakdown {
  const safeDeliveryFee = Math.max(0, deliveryFee || 0);
  const safeOtherCharges = Math.max(0, otherCharges || 0);
  const calculatedSharedFees = safeDeliveryFee + safeOtherCharges;

  // Calculate sum of all items
  const itemsSubtotal = Math.round(
    participantTotals.reduce((acc, curr) => acc + curr.itemSubtotal, 0) * 100
  ) / 100;

  // Determine the final total to reconcile against
  const finalPayable = overrideFinalPayableAmount !== undefined && overrideFinalPayableAmount > 0
    ? overrideFinalPayableAmount
    : itemsSubtotal + calculatedSharedFees;

  const effectiveSharedFees = Math.max(0, Math.round((finalPayable - itemsSubtotal) * 100) / 100);

  // If no items or only 1 participant
  if (participantTotals.length === 0) {
    return {
      itemsSubtotal: 0,
      deliveryFee: safeDeliveryFee,
      otherCharges: safeOtherCharges,
      totalSharedFees: effectiveSharedFees,
      finalPayableAmount: finalPayable,
      splits: [],
      allocationMethod: 'Proportional by item subtotal (empty)',
    };
  }

  if (itemsSubtotal === 0) {
    // If items total is 0, split fees equally among participants
    const n = participantTotals.length;
    const totalPaise = Math.round(effectiveSharedFees * 100);
    const basePaise = Math.floor(totalPaise / n);
    let remainderPaise = totalPaise - basePaise * n;

    const splits: SplitResult[] = participantTotals.map((p) => {
      const feePaise = basePaise + (remainderPaise > 0 ? 1 : 0);
      if (remainderPaise > 0) remainderPaise--;
      const allocatedFee = feePaise / 100;
      return {
        userId: p.userId,
        itemSubtotal: 0,
        allocatedFee,
        totalDue: allocatedFee,
        proportionPercent: Math.round((100 / n) * 100) / 100,
      };
    });

    return {
      itemsSubtotal: 0,
      deliveryFee: safeDeliveryFee,
      otherCharges: safeOtherCharges,
      totalSharedFees: effectiveSharedFees,
      finalPayableAmount: finalPayable,
      splits,
      allocationMethod: 'Equal split (items subtotal was ₹0)',
    };
  }

  // Convert to paise (cents) for exact integer arithmetic
  const sharedFeesPaise = Math.round(effectiveSharedFees * 100);

  // Sort indices by item subtotal descending for deterministic remainder allocation
  const sortedIndices = participantTotals
    .map((p, idx) => ({ idx, subtotal: p.itemSubtotal }))
    .sort((a, b) => b.subtotal - a.subtotal);

  // Initial floor allocation
  const allocatedPaiseList: number[] = new Array(participantTotals.length).fill(0);
  let allocatedSumPaise = 0;

  for (let i = 0; i < participantTotals.length; i++) {
    const rawPaise = Math.floor(
      (sharedFeesPaise * participantTotals[i].itemSubtotal) / itemsSubtotal
    );
    allocatedPaiseList[i] = rawPaise;
    allocatedSumPaise += rawPaise;
  }

  // Remainder paise to distribute to top contributors
  let remainderPaise = sharedFeesPaise - allocatedSumPaise;
  let cursor = 0;
  while (remainderPaise > 0 && cursor < sortedIndices.length) {
    const targetIdx = sortedIndices[cursor].idx;
    allocatedPaiseList[targetIdx] += 1;
    remainderPaise -= 1;
    cursor = (cursor + 1) % sortedIndices.length;
  }

  const splits: SplitResult[] = participantTotals.map((p, idx) => {
    const allocatedFee = Math.round(allocatedPaiseList[idx]) / 100;
    const totalDue = Math.round((p.itemSubtotal + allocatedFee) * 100) / 100;
    const proportionPercent = Math.round((p.itemSubtotal / itemsSubtotal) * 1000) / 10;
    return {
      userId: p.userId,
      itemSubtotal: p.itemSubtotal,
      allocatedFee,
      totalDue,
      proportionPercent,
    };
  });

  return {
    itemsSubtotal,
    deliveryFee: safeDeliveryFee,
    otherCharges: safeOtherCharges,
    totalSharedFees: effectiveSharedFees,
    finalPayableAmount: finalPayable,
    splits,
    allocationMethod: 'Deterministic Proportional Allocation by Item Subtotal with Remainder Distribution',
  };
}
