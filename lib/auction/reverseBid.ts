import { adminDb } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError } from '../validation';

export interface ReverseBidInput {
  playerId: string;
  locationId: string;
}

export interface ReverseBidResult {
  success: boolean;
  playerId: string;
  previousAmount: number | null;
  previousTeamId: string | null;
  locationId: string;
}

export async function reverseBidTransaction(input: ReverseBidInput): Promise<ReverseBidResult> {
  const playerRef = adminDb.collection('players').doc(input.playerId);

  return await adminDb.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists) throw new ValidationError('Player does not exist.', 404);

    const playerData = playerDoc.data()!;
    if (playerData.status !== 'LIVE') {
      throw new ValidationError(`Cannot reverse bid on player with status '${playerData.status}'.`, 400);
    }

    // Find the latest active bid
    const latestBidsQuery = adminDb
      .collection('bids')
      .where('playerId', '==', input.playerId)
      .where('status', '==', 'ACTIVE')
      .orderBy('createdAt', 'desc')
      .limit(2);

    const bidsSnapshot = await transaction.get(latestBidsQuery);

    if (bidsSnapshot.empty) {
      throw new ValidationError('No active bids to reverse for this player.', 400);
    }

    const currentLatestBidDoc = bidsSnapshot.docs[0]!;
    // Mark current latest as REVERSED
    transaction.update(currentLatestBidDoc.ref, {
      status: 'REVERSED',
      reversedAt: FieldValue.serverTimestamp(),
    });

    let previousAmount: number | null = null;
    let previousTeamId: string | null = null;
    let previousBidId: string | null = null;

    if (bidsSnapshot.docs.length > 1) {
      const priorBidDoc = bidsSnapshot.docs[1]!;
      const priorData = priorBidDoc.data();
      previousAmount = priorData.amount;
      previousTeamId = priorData.teamId;
      previousBidId = priorBidDoc.id;
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(playerRef, {
      currentBid: previousAmount,
      currentBidTeamId: previousTeamId,
      currentBidId: previousBidId,
      updatedAt: now,
    });

    return {
      success: true,
      playerId: input.playerId,
      previousAmount,
      previousTeamId,
      locationId: input.locationId,
    };
  });
}
