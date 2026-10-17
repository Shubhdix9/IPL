import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locationId, playerId, durationSeconds } = body;

    if (!locationId || !playerId) {
      return errorResponse({ message: 'locationId and playerId are required.' }, 400);
    }

    const duration = Number(durationSeconds) || 30;
    const deadlineMs = Date.now() + duration * 1000;

    const playerRef = adminDb.collection('players').doc(playerId);
    const locationRef = adminDb.collection('locations').doc(locationId);

    const now = FieldValue.serverTimestamp();

    // Demote any previous LIVE player so only ONE player is LIVE
    const existingLiveSnap = await adminDb
      .collection('players')
      .where('locationId', '==', locationId)
      .where('status', '==', 'LIVE')
      .get();

    const batch = adminDb.batch();
    existingLiveSnap.docs.forEach((d: any) => {
      if (d.id !== playerId) {
        batch.update(d.ref, {
          status: 'UNSOLD',
          updatedAt: now,
        });
      }
    });

    batch.update(playerRef, {
      status: 'LIVE',
      currentBid: null,
      currentBidTeamId: null,
      currentBidId: null,
      updatedAt: now,
    });

    batch.update(locationRef, {
      activePlayerId: playerId,
      auctionStatus: 'LIVE',
      timerDeadlineMs: deadlineMs,
      timerDurationSeconds: duration,
      timerPaused: false,
      timerRemainingMs: duration * 1000,
      updatedAt: now,
    });

    await batch.commit();

    const updated = await playerRef.get();
    return jsonResponse({
      id: updated.id,
      ...updated.data(),
      timerDeadlineMs: deadlineMs,
      timerDurationSeconds: duration,
    });
  } catch (error: any) {
    return errorResponse(error);
  }
}
