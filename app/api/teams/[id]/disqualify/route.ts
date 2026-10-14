import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { setTeamDisqualification, getTeamById } from '@/lib/firestore/teams';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isDisqualified } = body;

    await setTeamDisqualification(id, Boolean(isDisqualified));
    const updatedTeam = await getTeamById(id);

    return jsonResponse(updatedTeam);
  } catch (error: any) {
    return errorResponse(error);
  }
}
