import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { updateUserPassword } from '@/lib/firestore/users';

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
    const { password } = body;

    if (!password) {
      return errorResponse({ message: 'Password is required.' }, 400);
    }

    await updateUserPassword(id, password);
    return jsonResponse({ success: true, message: 'Password updated successfully.' });
  } catch (error: any) {
    return errorResponse(error);
  }
}
