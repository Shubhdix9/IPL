import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { issuePenaltyTransaction, reversePenaltyTransaction } from '@/lib/auction/issuePenalty';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return errorResponse({ message: 'teamId is required.' }, 400);
    }

    const result = await issuePenaltyTransaction(teamId);
    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return errorResponse({ message: 'teamId query parameter is required.' }, 400);
    }

    const result = await reversePenaltyTransaction(teamId);
    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error);
  }
}
