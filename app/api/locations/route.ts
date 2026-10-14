import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { getAllLocations, createLocationWithTeams } from '@/lib/firestore/locations';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const locations = await getAllLocations();
    return jsonResponse(locations);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, city } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse({ message: 'Venue name is required.' }, 400);
    }

    const location = await createLocationWithTeams(name, city);
    return jsonResponse(location, 201);
  } catch (error: any) {
    return errorResponse(error);
  }
}
