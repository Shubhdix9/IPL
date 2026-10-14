import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locationId, playerId } = body;

    if (!locationId || !playerId) {
      return errorResponse({ message: 'locationId and playerId are required.' }, 400);
    }

    const playerRef = adminDb.collection('players').doc(playerId);
    const locationRef = adminDb.collection('locations').doc(locationId);

    const now = FieldValue.serverTimestamp();

    await adminDb.runTransaction(async (transaction: any) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) throw new Error('Player not found.');

      transaction.update(playerRef, {
        status: 'LIVE',
        currentBid: null,
        currentBidTeamId: null,
        currentBidId: null,
        updatedAt: now,
      });

      transaction.update(locationRef, {
        activePlayerId: playerId,
        updatedAt: now,
      });
    });

    const updated = await playerRef.get();
    return jsonResponse({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    return errorResponse(error);
  }
}
