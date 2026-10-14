import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { getAllTeams } from '@/lib/firestore/teams';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const teams = await getAllTeams();
    return jsonResponse(teams);
  } catch (error: any) {
    return errorResponse(error);
  }
}
