import { handleOptions, jsonResponse, errorResponse, enforceRateLimit } from '@/lib/apiResponse';
import { placeBidTransaction } from '@/lib/auction/placeBid';
import { verifyAuth } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  const rateLimitBlock = enforceRateLimit(request, 60);
  if (rateLimitBlock) return rateLimitBlock;

  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { playerId, teamId, locationId, amount } = body;

    if (!playerId || !teamId || !locationId || amount == null) {
      return errorResponse({ message: 'playerId, teamId, locationId, and amount are required.' }, 400);
    }

    const result = await placeBidTransaction({
      playerId,
      teamId,
      locationId,
      amount,
      user,
    });

    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}
