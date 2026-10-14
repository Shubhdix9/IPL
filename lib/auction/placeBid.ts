import { adminDb } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateMonetaryAmount, validateBidAmount, ValidationError } from '../validation';
import { AuthenticatedUser } from '../auth';

export interface PlaceBidInput {
  playerId: string;
  teamId: string;
  locationId: string;
  amount: number;
  user: AuthenticatedUser | null;
}

export interface PlaceBidResult {
  success: boolean;
  bidId: string;
  playerId: string;
  teamId: string;
  amount: number;
  locationId: string;
}

export async function placeBidTransaction(input: PlaceBidInput): Promise<PlaceBidResult> {
  const amount = validateMonetaryAmount(input.amount, 'bid amount');
  const playerRef = adminDb.collection('players').doc(input.playerId);
  const teamRef = adminDb.collection('teams').doc(input.teamId);
  const locationRef = adminDb.collection('locations').doc(input.locationId);

  return await adminDb.runTransaction(async (transaction) => {
    const [playerDoc, teamDoc, locationDoc] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(teamRef),
      transaction.get(locationRef),
    ]);

    if (!playerDoc.exists) {
      throw new ValidationError(`Player with ID ${input.playerId} does not exist.`, 404);
    }
    if (!teamDoc.exists) {
      throw new ValidationError(`Team with ID ${input.teamId} does not exist.`, 404);
    }
    if (!locationDoc.exists) {
      throw new ValidationError(`Location with ID ${input.locationId} does not exist.`, 404);
    }

    const playerData = playerDoc.data()!;
    const teamData = teamDoc.data()!;
    const locationData = locationDoc.data()!;

    // 1. Verify location consistency
    if (String(playerData.locationId) !== String(input.locationId) || String(teamData.locationId) !== String(input.locationId)) {
      throw new ValidationError('Player and team must belong to the specified auction venue.', 400);
    }

    // 2. Verify player is LIVE
    if (playerData.status !== 'LIVE') {
      throw new ValidationError(`Cannot bid on player with status '${playerData.status}'. Player must be LIVE.`, 400);
    }

    // 3. Verify team is not disqualified
    if (teamData.isDisqualified) {
      throw new ValidationError(`Team ${teamData.name} is disqualified and cannot place bids.`, 403);
    }

    // 4. Verify auction is not on a break
    if (locationData.isOnBreak) {
      throw new ValidationError('Auction is currently on a break. Bids are paused.', 400);
    }

    // 5. Verify bid amount is strictly higher than current bid or base price
    const currentHigh = Number(playerData.currentBid || playerData.basePrice || 0);
    validateBidAmount(amount, currentHigh);

    // 6. Verify team has sufficient budget
    const teamBudget = Number(teamData.budget || 0);
    if (amount > teamBudget) {
      throw new ValidationError(
        `Insufficient budget: Team ${teamData.name} only has ₹${teamBudget / 10_000_000} Cr remaining, cannot bid ₹${amount / 10_000_000} Cr.`,
        400
      );
    }

    // Create bid document
    const bidRef = adminDb.collection('bids').doc();
    const now = FieldValue.serverTimestamp();

    transaction.set(bidRef, {
      locationId: input.locationId,
      playerId: input.playerId,
      teamId: input.teamId,
      amount,
      status: 'ACTIVE',
      createdBy: input.user?.username || 'SYSTEM',
      createdAt: now,
    });

    // Update player current bid state
    transaction.update(playerRef, {
      currentBid: amount,
      currentBidTeamId: input.teamId,
      currentBidId: bidRef.id,
      updatedAt: now,
    });

    return {
      success: true,
      bidId: bidRef.id,
      playerId: input.playerId,
      teamId: input.teamId,
      amount,
      locationId: input.locationId,
    };
  });
}
