import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { reverseBidTransaction } from '@/lib/auction/reverseBid';

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

    const result = await reverseBidTransaction({ locationId, playerId });
    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}
