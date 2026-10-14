import { adminDb } from '../firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_TEAM_BUDGET } from '../validation';
import { PlayerDocument } from './players';

export interface TeamDocument {
  id: string;
  name: string;
  shortName?: string;
  locationId: string;
  budget: number;
  initialBudget: number;
  mistakes: number;
  isDisqualified: boolean;
  ownerUserId?: string;
  players?: PlayerDocument[];
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export const TEAMS_COLLECTION = 'teams';

export async function getAllTeams(): Promise<TeamDocument[]> {
  const [teamsSnap, playersSnap] = await Promise.all([
    adminDb.collection(TEAMS_COLLECTION).get(),
    adminDb.collection('players').where('status', '==', 'SOLD').get(),
  ]);

  const soldPlayersByTeam = new Map<string, PlayerDocument[]>();
  playersSnap.forEach(pDoc => {
    const p = { id: pDoc.id, ...pDoc.data() } as PlayerDocument;
    if (p.teamId) {
      const existing = soldPlayersByTeam.get(String(p.teamId)) || [];
      existing.push(p);
      soldPlayersByTeam.set(String(p.teamId), existing);
    }
  });

  return teamsSnap.docs.map(tDoc => {
    const data = tDoc.data();
    return {
      id: tDoc.id,
      ...data,
      players: soldPlayersByTeam.get(tDoc.id) || [],
    } as TeamDocument;
  });
}

export async function getTeamsByLocation(locationId: string): Promise<TeamDocument[]> {
  const [teamsSnap, playersSnap] = await Promise.all([
    adminDb.collection(TEAMS_COLLECTION).where('locationId', '==', locationId).get(),
    adminDb.collection('players').where('locationId', '==', locationId).where('status', '==', 'SOLD').get(),
  ]);

  const soldPlayersByTeam = new Map<string, PlayerDocument[]>();
  playersSnap.forEach(pDoc => {
    const p = { id: pDoc.id, ...pDoc.data() } as PlayerDocument;
    if (p.teamId) {
      const existing = soldPlayersByTeam.get(String(p.teamId)) || [];
      existing.push(p);
      soldPlayersByTeam.set(String(p.teamId), existing);
    }
  });

  return teamsSnap.docs.map(tDoc => {
    const data = tDoc.data();
    return {
      id: tDoc.id,
      ...data,
      players: soldPlayersByTeam.get(tDoc.id) || [],
    } as TeamDocument;
  });
}

export async function getTeamById(teamId: string): Promise<TeamDocument | null> {
  const doc = await adminDb.collection(TEAMS_COLLECTION).doc(teamId).get();
  if (!doc.exists) return null;

  const playersSnap = await adminDb
    .collection('players')
    .where('teamId', '==', teamId)
    .where('status', '==', 'SOLD')
    .get();

  const players = playersSnap.docs.map(p => ({ id: p.id, ...p.data() } as PlayerDocument));

  return {
    id: doc.id,
    ...doc.data(),
    players,
  } as TeamDocument;
}

export async function setTeamDisqualification(teamId: string, isDisqualified: boolean): Promise<void> {
  await adminDb.collection(TEAMS_COLLECTION).doc(teamId).update({
    isDisqualified,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function resetTeamBudgetsAndPenalties(): Promise<void> {
  const teamsSnap = await adminDb.collection(TEAMS_COLLECTION).get();
  const batch = adminDb.batch();

  teamsSnap.forEach(doc => {
    batch.update(doc.ref, {
      budget: DEFAULT_TEAM_BUDGET,
      mistakes: 0,
      isDisqualified: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}
