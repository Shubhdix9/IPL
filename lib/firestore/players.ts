import { adminDb } from '../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PlayerCategory, PlayerStatus } from '../validation';
import { TeamDocument } from './teams';

export interface PlayerDocument {
  id: string;
  name: string;
  category: PlayerCategory;
  basePrice: number;
  points: number;
  pool: string | null;
  country: string | null;
  imageUrl: string | null;
  locationId: string;
  status: PlayerStatus;
  currentBid?: number | null;
  currentBidTeamId?: string | null;
  currentBidId?: string | null;
  soldPrice?: number | null;
  teamId?: string | null;
  team?: Partial<TeamDocument> | null;
  createdAt: Timestamp | string | FieldValue;
  updatedAt: Timestamp | string | FieldValue;
}

export const PLAYERS_COLLECTION = 'players';

export async function getPlayersByLocation(locationId: string): Promise<PlayerDocument[]> {
  const [playersSnap, teamsSnap] = await Promise.all([
    adminDb.collection(PLAYERS_COLLECTION).where('locationId', '==', locationId).get(),
    adminDb.collection('teams').where('locationId', '==', locationId).get(),
  ]);

  const teamsMap = new Map<string, Partial<TeamDocument>>();
  teamsSnap.forEach(doc => {
    teamsMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  return playersSnap.docs.map(doc => {
    const data = doc.data() as Omit<PlayerDocument, 'id'>;
    return {
      ...data,
      id: doc.id,
      team: data.teamId ? teamsMap.get(String(data.teamId)) || null : null,
    };
  });
}

export async function getPlayerById(playerId: string): Promise<PlayerDocument | null> {
  const doc = await adminDb.collection(PLAYERS_COLLECTION).doc(playerId).get();
  if (!doc.exists) return null;
  
  const data = doc.data() as Omit<PlayerDocument, 'id'>;
  let team: Partial<TeamDocument> | null = null;
  if (data.teamId) {
    const teamDoc = await adminDb.collection('teams').doc(String(data.teamId)).get();
    if (teamDoc.exists) {
      team = { id: teamDoc.id, ...teamDoc.data() };
    }
  }

  return {
    ...data,
    id: doc.id,
    team,
  };
}

export interface RawPlayerInput {
  name: string;
  category: PlayerCategory;
  basePrice: number;
  points?: number;
  pool?: string | null;
  country?: string | null;
  imageUrl?: string | null;
  debutYear?: number | null;
}

/**
 * Duplicates a roster of players across all registered locations.
 */
export async function bulkInsertPlayersGlobal(
  players: RawPlayerInput[]
): Promise<{ success: boolean; count: number; locationsCount: number }> {
  const locationsSnap = await adminDb.collection('locations').get();
  if (locationsSnap.empty) {
    throw new Error('No venues found. Please create at least one venue first.');
  }

  const now = FieldValue.serverTimestamp();
  let totalInserted = 0;

  // Process in batches of 450 (Firestore limit is 500 writes per batch)
  let currentBatch = adminDb.batch();
  let opsInBatch = 0;

  for (const locDoc of locationsSnap.docs) {
    const locId = locDoc.id;

    for (const p of players) {
      const playerRef = adminDb.collection(PLAYERS_COLLECTION).doc();
      const playerData: Omit<PlayerDocument, 'id'> = {
        name: p.name.trim(),
        category: p.category,
        basePrice: Number(p.basePrice) || 20_000_000,
        points: Number(p.points) || 0,
        pool: p.pool || null,
        country: p.country || 'IND',
        imageUrl: p.imageUrl || null,
        locationId: locId,
        status: 'UPCOMING',
        currentBid: null,
        currentBidTeamId: null,
        currentBidId: null,
        soldPrice: null,
        teamId: null,
        createdAt: now,
        updatedAt: now,
      };

      currentBatch.set(playerRef, playerData);
      opsInBatch++;
      totalInserted++;

      if (opsInBatch >= 450) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opsInBatch = 0;
      }
    }
  }

  if (opsInBatch > 0) {
    await currentBatch.commit();
  }

  return {
    success: true,
    count: totalInserted,
    locationsCount: locationsSnap.size,
  };
}

/**
 * Danger Zone: wipes all player records and associated bids.
 */
export async function deleteAllPlayers(): Promise<void> {
  // Batch delete players
  const playersSnap = await adminDb.collection(PLAYERS_COLLECTION).get();
  let batch = adminDb.batch();
  let count = 0;

  for (const doc of playersSnap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
  }

  // Batch delete bids
  const bidsSnap = await adminDb.collection('bids').get();
  batch = adminDb.batch();
  count = 0;

  for (const doc of bidsSnap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
}
