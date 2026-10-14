import { adminDb } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateMonetaryAmount, ValidationError } from '../validation';

export interface SellPlayerInput {
  playerId: string;
  teamId: string;
  locationId: string;
  amount: number;
}

export interface SellPlayerResult {
  success: boolean;
  player: any;
  team: any;
}

export async function sellPlayerTransaction(input: SellPlayerInput): Promise<SellPlayerResult> {
  const amount = validateMonetaryAmount(input.amount, 'sale price');
  const playerRef = adminDb.collection('players').doc(input.playerId);
  const teamRef = adminDb.collection('teams').doc(input.teamId);
  const locationRef = adminDb.collection('locations').doc(input.locationId);

  return await adminDb.runTransaction(async (transaction) => {
    const [playerDoc, teamDoc, locationDoc] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(teamRef),
      transaction.get(locationRef),
    ]);

    if (!playerDoc.exists) throw new ValidationError('Player does not exist.', 404);
    if (!teamDoc.exists) throw new ValidationError('Team does not exist.', 404);
    if (!locationDoc.exists) throw new ValidationError('Location does not exist.', 404);

    const playerData = playerDoc.data()!;
    const teamData = teamDoc.data()!;

    // Idempotency check: if already sold with identical team and price, return safely
    if (playerData.status === 'SOLD' && String(playerData.teamId) === String(input.teamId) && Number(playerData.soldPrice) === amount) {
      return {
        success: true,
        player: { id: playerDoc.id, ...playerData },
        team: { id: teamDoc.id, ...teamData },
      };
    }

    if (playerData.status !== 'LIVE') {
      throw new ValidationError(`Player must be LIVE to be sold. Current status is '${playerData.status}'.`, 400);
    }

    if (String(playerData.locationId) !== String(input.locationId) || String(teamData.locationId) !== String(input.locationId)) {
      throw new ValidationError('Player and team must belong to this auction location.', 400);
    }

    const currentBudget = Number(teamData.budget || 0);
    if (currentBudget < amount) {
      throw new ValidationError(
        `Team ${teamData.name} does not have sufficient purse (Remaining: ₹${currentBudget / 10_000_000} Cr, Price: ₹${amount / 10_000_000} Cr).`,
        400
      );
    }

    const newBudget = currentBudget - amount;
    const now = FieldValue.serverTimestamp();

    // 1. Update player to SOLD
    transaction.update(playerRef, {
      status: 'SOLD',
      soldPrice: amount,
      teamId: input.teamId,
      updatedAt: now,
    });

    // 2. Atomically deduct purse from winning team
    transaction.update(teamRef, {
      budget: newBudget,
      updatedAt: now,
    });

    // 3. Clear active player in location
    transaction.update(locationRef, {
      activePlayerId: null,
      updatedAt: now,
    });

    // 4. Mark winning bid if exists
    if (playerData.currentBidId) {
      const bidRef = adminDb.collection('bids').doc(String(playerData.currentBidId));
      transaction.update(bidRef, { status: 'WINNING' });
    }

    return {
      success: true,
      player: {
        id: playerDoc.id,
        ...playerData,
        status: 'SOLD',
        soldPrice: amount,
        teamId: input.teamId,
      },
      team: {
        id: teamDoc.id,
        ...teamData,
        budget: newBudget,
      },
    };
  });
}
