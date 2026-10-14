import { handleOptions, jsonResponse, errorResponse } from '@/lib/apiResponse';
import { getAllUsers, createNewUser } from '@/lib/firestore/users';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const users = await getAllUsers();
    return jsonResponse(users);
  } catch (error: any) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, role, teamId, locationId } = body;

    if (!username || !role) {
      return errorResponse({ message: 'Username and role are required.' }, 400);
    }

    const newUser = await createNewUser({
      username,
      password,
      role,
      teamId,
      locationId,
    });

    return jsonResponse(newUser, 201);
  } catch (error: any) {
    return errorResponse(error);
  }
}
