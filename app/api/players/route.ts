import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { deleteAllPlayers } from '@/lib/firestore/players';
import { resetTeamBudgetsAndPenalties } from '@/lib/firestore/teams';

export async function OPTIONS() {
  return handleOptions();
}

export async function DELETE() {
  try {
    await deleteAllPlayers();
    await resetTeamBudgetsAndPenalties();
    return jsonResponse({
      success: true,
      message: 'All players and bids deleted, and team budgets have been reset to ₹90 Cr.',
    });
  } catch (error: any) {
    return errorResponse(error);
  }
}
