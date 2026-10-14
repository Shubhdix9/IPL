import { adminDb } from '../firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export interface BidDocument {
  id: string;
  locationId: string;
  playerId: string;
  teamId: string;
  amount: number;
  status: 'ACTIVE' | 'REVERSED' | 'WINNING';
  createdBy?: string;
  createdAt: Timestamp | string;
}

export const BIDS_COLLECTION = 'bids';

export async function getBidsByPlayer(playerId: string): Promise<BidDocument[]> {
  const snapshot = await adminDb
    .collection(BIDS_COLLECTION)
    .where('playerId', '==', playerId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as BidDocument[];
}

export async function getLatestBidForPlayer(playerId: string): Promise<BidDocument | null> {
  const snapshot = await adminDb
    .collection(BIDS_COLLECTION)
    .where('playerId', '==', playerId)
    .where('status', '==', 'ACTIVE')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0]!;
  return { id: doc.id, ...doc.data() } as BidDocument;
}
