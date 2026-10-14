import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { getLocationById, deleteLocationCascade } from '@/lib/firestore/locations';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const location = await getLocationById(id);
    if (!location) return errorResponse({ message: 'Location not found.' }, 404);
    return jsonResponse(location);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteLocationCascade(id);
    return jsonResponse({ success: true, message: 'Location deleted successfully.' });
  } catch (error: any) {
    return errorResponse(error);
  }
}
