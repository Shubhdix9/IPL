import { adminAuth, adminDb } from '../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '../validation';

export interface UserDocument {
  id: string;
  uid: string;
  username: string;
  email: string;
  role: UserRole;
  locationId?: string | null;
  teamId?: string | null;
  isActive: boolean;
  passwordHash?: string; // Kept only for transition/emulated auth if Firebase Auth not active
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export const USERS_COLLECTION = 'users';

export async function getAllUsers(): Promise<UserDocument[]> {
  const [usersSnap, teamsSnap, locationsSnap] = await Promise.all([
    adminDb.collection(USERS_COLLECTION).get(),
    adminDb.collection('teams').get(),
    adminDb.collection('locations').get(),
  ]);

  const teamsMap = new Map<string, any>();
  teamsSnap.forEach(t => teamsMap.set(t.id, { id: t.id, ...t.data() }));

  const locationsMap = new Map<string, any>();
  locationsSnap.forEach(l => locationsMap.set(l.id, { id: l.id, ...l.data() }));

  return usersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: data.uid || doc.id,
      username: data.username,
      email: data.email,
      role: data.role,
      locationId: data.locationId || null,
      teamId: data.teamId || null,
      isActive: data.isActive !== false,
      team: data.teamId ? teamsMap.get(String(data.teamId)) || null : null,
      location: data.locationId ? locationsMap.get(String(data.locationId)) || null : null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as unknown as UserDocument;
  });
}

export async function getUserByUsername(username: string): Promise<UserDocument | null> {
  const snapshot = await adminDb
    .collection(USERS_COLLECTION)
    .where('username', '==', username.trim().toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) {
    // Try case-exact match
    const snapshotExact = await adminDb
      .collection(USERS_COLLECTION)
      .where('username', '==', username.trim())
      .limit(1)
      .get();
    if (snapshotExact.empty) return null;
    const doc = snapshotExact.docs[0]!;
    return { id: doc.id, ...doc.data() } as UserDocument;
  }

  const doc = snapshot.docs[0]!;
  return { id: doc.id, ...doc.data() } as UserDocument;
}

export async function createNewUser(params: {
  username: string;
  password?: string;
  role: UserRole;
  locationId?: string | null;
  teamId?: string | null;
}): Promise<UserDocument> {
  const cleanUsername = params.username.trim().toLowerCase();
  const existing = await getUserByUsername(cleanUsername);
  if (existing) {
    throw new Error(`User with username '${cleanUsername}' already exists.`);
  }

  const userDocRef = adminDb.collection(USERS_COLLECTION).doc();
  const email = `${cleanUsername}@iplauction.local`;
  let uid = userDocRef.id;

  // Attempt to provision in Firebase Authentication if password provided
  if (params.password) {
    try {
      const authUser = await adminAuth.createUser({
        email,
        password: params.password,
        displayName: cleanUsername,
      });
      uid = authUser.uid;
      
      // Set custom claims
      await adminAuth.setCustomUserClaims(uid, {
        role: params.role,
        locationId: params.locationId || null,
        teamId: params.teamId || null,
      });
    } catch (err: any) {
      console.warn('[createNewUser] Firebase Auth create skipped or failed, storing profile in Firestore:', err.message);
    }
  }

  const now = FieldValue.serverTimestamp();
  const userData = {
    uid,
    username: cleanUsername,
    email,
    role: params.role,
    locationId: params.locationId || null,
    teamId: params.teamId || null,
    isActive: true,
    // Store password fallback for local dev compatibility if needed
    passwordFallback: params.password || 'password',
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection(USERS_COLLECTION).doc(uid).set(userData);

  return {
    id: uid,
    ...userData,
  } as unknown as UserDocument;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const userDoc = await adminDb.collection(USERS_COLLECTION).doc(userId).get();
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }

  const data = userDoc.data()!;
  const uid = data.uid || userId;

  try {
    await adminAuth.updateUser(uid, { password: newPassword });
  } catch (err: any) {
    console.warn('[updateUserPassword] Firebase Auth update bypassed/failed:', err.message);
  }

  await adminDb.collection(USERS_COLLECTION).doc(userDoc.id).update({
    passwordFallback: newPassword,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  const userDoc = await adminDb.collection(USERS_COLLECTION).doc(userId).get();
  if (!userDoc.exists) return;

  const data = userDoc.data()!;
  const uid = data.uid || userId;

  try {
    await adminAuth.deleteUser(uid);
  } catch {
    // Might not exist in Auth
  }

  await adminDb.collection(USERS_COLLECTION).doc(userDoc.id).delete();
}
