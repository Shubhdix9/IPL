import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locationId, show } = body;

    if (!locationId) {
      return errorResponse({ message: 'locationId is required.' }, 400);
    }

    const locationRef = adminDb.collection('locations').doc(locationId);
    await locationRef.update({
      leaderboardVisible: Boolean(show),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return jsonResponse({ success: true, locationId, leaderboardVisible: Boolean(show) });
  } catch (error: any) {
    return errorResponse(error);
  }
}
