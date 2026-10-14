import { adminDb } from '../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_TEAM_BUDGET } from '../validation';

export interface LocationDocument {
  id: string;
  name: string;
  city?: string;
  isOnBreak: boolean;
  leaderboardVisible: boolean;
  activePlayerId: string | null;
  auctionStatus: 'UPCOMING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export const LOCATIONS_COLLECTION = 'locations';

export async function getAllLocations(): Promise<LocationDocument[]> {
  const snapshot = await adminDb.collection(LOCATIONS_COLLECTION).orderBy('name', 'asc').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as LocationDocument[];
}

export async function getLocationById(locationId: string): Promise<LocationDocument | null> {
  const doc = await adminDb.collection(LOCATIONS_COLLECTION).doc(locationId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as LocationDocument;
}

const DEFAULT_FRANCHISES = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];

/**
 * Creates a new location and automatically provisions its 10 franchise teams
 * and their owner user accounts idempotently in Firestore.
 */
export async function createLocationWithTeams(name: string, city?: string): Promise<LocationDocument> {
  const normalizedName = name.trim();
  
  // Check for duplicate location
  const existingSnapshot = await adminDb
    .collection(LOCATIONS_COLLECTION)
    .where('name', '==', normalizedName)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const existingDoc = existingSnapshot.docs[0]!;
    return { id: existingDoc.id, ...existingDoc.data() } as LocationDocument;
  }

  const locationRef = adminDb.collection(LOCATIONS_COLLECTION).doc();
  const now = FieldValue.serverTimestamp();

  const locationData = {
    name: normalizedName,
    city: city?.trim() || normalizedName,
    isOnBreak: false,
    leaderboardVisible: false,
    activePlayerId: null,
    auctionStatus: 'UPCOMING' as const,
    createdAt: now,
    updatedAt: now,
  };

  await locationRef.set(locationData);

  // Auto-generate standard 10 franchises for this location
  const batch = adminDb.batch();

  for (const teamName of DEFAULT_FRANCHISES) {
    const teamRef = adminDb.collection('teams').doc();
    const teamData = {
      name: teamName,
      shortName: teamName,
      locationId: locationRef.id,
      budget: DEFAULT_TEAM_BUDGET,
      initialBudget: DEFAULT_TEAM_BUDGET,
      mistakes: 0,
      isDisqualified: false,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(teamRef, teamData);

    // Provision franchise leader account record
    const userRef = adminDb.collection('users').doc();
    const cleanVenue = normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `owner_${cleanTeam}_${cleanVenue}`;

    batch.set(userRef, {
      uid: userRef.id,
      username,
      email: `${username}@iplauction.local`,
      role: 'TEAM_LEADER',
      teamId: teamRef.id,
      locationId: locationRef.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();

  return {
    id: locationRef.id,
    ...locationData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deletes a location and cascades deletion across its teams, players, and bids.
 */
export async function deleteLocationCascade(locationId: string): Promise<void> {
  const batch = adminDb.batch();

  // 1. Delete teams in location
  const teamsSnap = await adminDb.collection('teams').where('locationId', '==', locationId).get();
  teamsSnap.forEach(doc => batch.delete(doc.ref));

  // 2. Delete players in location
  const playersSnap = await adminDb.collection('players').where('locationId', '==', locationId).get();
  playersSnap.forEach(doc => batch.delete(doc.ref));

  // 3. Delete bids in location
  const bidsSnap = await adminDb.collection('bids').where('locationId', '==', locationId).get();
  bidsSnap.forEach(doc => batch.delete(doc.ref));

  // 4. Delete location doc
  batch.delete(adminDb.collection(LOCATIONS_COLLECTION).doc(locationId));

  await batch.commit();
}
