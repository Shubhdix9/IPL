import { adminAuth, adminDb } from './firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  username: string;
  role: 'ADMIN' | 'AUCTIONEER' | 'TEAM_LEADER';
  locationId?: string | number | null;
  teamId?: string | number | null;
  isActive: boolean;
}

/**
 * Extracts and verifies the Firebase ID token from the incoming Request.
 * Returns the AuthenticatedUser with roles and metadata from Firestore.
 */
export async function verifyAuth(request: Request): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Fetch user document from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      // Fallback to token claims if Firestore doc not yet created
      return {
        uid,
        email: decoded.email,
        username: (decoded.username as string) || decoded.email || uid,
        role: (decoded.role as 'ADMIN' | 'AUCTIONEER' | 'TEAM_LEADER') || 'TEAM_LEADER',
        locationId: decoded.locationId as string | number | null,
        teamId: decoded.teamId as string | number | null,
        isActive: true,
      };
    }

    const data = userDoc.data()!;
    if (data.isActive === false) {
      return null;
    }

    return {
      uid,
      email: data.email || decoded.email,
      username: data.username,
      role: data.role,
      locationId: data.locationId,
      teamId: data.teamId,
      isActive: data.isActive !== false,
    };
  } catch (error) {
    console.error('[verifyAuth] Token verification failed:', error);
    return null;
  }
}
