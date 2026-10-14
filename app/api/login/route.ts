import { handleOptions, jsonResponse, errorResponse, enforceRateLimit } from '@/lib/apiResponse';
import { getUserByUsername } from '@/lib/firestore/users';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  const rateLimitBlock = enforceRateLimit(request, 30);
  if (rateLimitBlock) return rateLimitBlock;

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse({ message: 'Username and password are required.' }, 400);
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return errorResponse({ message: 'Invalid credentials.' }, 401);
    }

    // Verify password against fallback or default
    const expectedPassword = (user as any).passwordFallback || 'password';
    if (password !== expectedPassword) {
      return errorResponse({ message: 'Invalid credentials.' }, 401);
    }

    // Generate Firebase Custom Token for client SDK sign-in
    let customToken = '';
    try {
      customToken = await adminAuth.createCustomToken(user.uid || user.id, {
        role: user.role,
        locationId: user.locationId,
        teamId: user.teamId,
      });
    } catch (err: any) {
      console.warn('[login] createCustomToken fallback:', err.message);
    }

    const responsePayload = {
      id: user.id,
      uid: user.uid || user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      teamId: user.teamId,
      token: customToken,
    };

    return jsonResponse(responsePayload);
  } catch (error: any) {
    return errorResponse(error);
  }
}
