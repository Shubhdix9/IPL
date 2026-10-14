import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { deleteUser } from '@/lib/firestore/users';

export async function OPTIONS() {
  return handleOptions();
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteUser(id);
    return jsonResponse({ success: true, message: 'User deleted.' });
  } catch (error: any) {
    return errorResponse(error);
  }
}
