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
      transaction.update(playerRef, {
        status: 'UNSOLD',
        currentBid: null,
        currentBidTeamId: null,
        updatedAt: now,
      });

      transaction.update(locationRef, {
        activePlayerId: null,
        updatedAt: now,
      });
    });

    const updated = await playerRef.get();
    return jsonResponse({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    return errorResponse(error);
  }
}
