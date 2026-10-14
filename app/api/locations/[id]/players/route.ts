import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { getPlayersByLocation } from '@/lib/firestore/players';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const players = await getPlayersByLocation(id);
    return jsonResponse(players);
  } catch (error: any) {
    return errorResponse(error);
  }
}
