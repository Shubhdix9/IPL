import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { sellPlayerTransaction } from '@/lib/auction/sellPlayer';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locationId, playerId, teamId, amount } = body;

    if (!locationId || !playerId || !teamId || amount == null) {
      return errorResponse({ message: 'locationId, playerId, teamId, and amount are required.' }, 400);
    }

    const result = await sellPlayerTransaction({
      locationId,
      playerId,
      teamId,
      amount,
    });

    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}
