import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { bulkInsertPlayersGlobal } from '@/lib/firestore/players';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { players } = body;

    if (!Array.isArray(players) || players.length === 0) {
      return errorResponse({ message: 'Request body must contain a non-empty "players" array.' }, 400);
    }

    const result = await bulkInsertPlayersGlobal(players);
    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}
