import { adminDb } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError } from '../validation';

export interface ReopenPlayerInput {
  playerId: string;
  locationId: string;
}

export interface ReopenPlayerResult {
  success: boolean;
  player: any;
  refundedTeamId?: string | null;
  refundedAmount?: number | null;
}

export async function reopenPlayerTransaction(input: ReopenPlayerInput): Promise<ReopenPlayerResult> {
  const playerRef = adminDb.collection('players').doc(input.playerId);
  const locationRef = adminDb.collection('locations').doc(input.locationId);

  return await adminDb.runTransaction(async (transaction) => {
    const [playerDoc, locationDoc] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(locationRef),
    ]);

    if (!playerDoc.exists) throw new ValidationError('Player does not exist.', 404);
    if (!locationDoc.exists) throw new ValidationError('Location does not exist.', 404);

    const playerData = playerDoc.data()!;

    if (playerData.status === 'LIVE') {
      return { success: true, player: { id: playerDoc.id, ...playerData } };
    }

    let refundedTeamId: string | null = null;
    let refundedAmount: number | null = null;
    const now = FieldValue.serverTimestamp();

    // If player was sold, atomically refund team budget
    if (playerData.status === 'SOLD' && playerData.teamId && playerData.soldPrice) {
      const teamRef = adminDb.collection('teams').doc(String(playerData.teamId));
      const teamDoc = await transaction.get(teamRef);

      if (teamDoc.exists) {
        const teamData = teamDoc.data()!;
        const currentBudget = Number(teamData.budget || 0);
        refundedAmount = Number(playerData.soldPrice);
        refundedTeamId = String(playerData.teamId);

        transaction.update(teamRef, {
          budget: currentBudget + refundedAmount,
          updatedAt: now,
        });
      }
    }

    // Reset player back to LIVE
    transaction.update(playerRef, {
      status: 'LIVE',
      soldPrice: null,
      teamId: null,
      updatedAt: now,
    });

    // Set as active player in location
    transaction.update(locationRef, {
      activePlayerId: input.playerId,
      updatedAt: now,
    });

    return {
      success: true,
      player: {
        id: playerDoc.id,
        ...playerData,
        status: 'LIVE',
        soldPrice: null,
        teamId: null,
      },
      refundedTeamId,
      refundedAmount,
    };
  });
}
