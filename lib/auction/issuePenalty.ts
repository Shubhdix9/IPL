import { adminDb } from '../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError } from '../validation';

export interface PenaltyResult {
  teamId: string;
  mistakes: number;
  isDisqualified: boolean;
}

export async function issuePenaltyTransaction(teamId: string): Promise<PenaltyResult> {
  const teamRef = adminDb.collection('teams').doc(teamId);

  return await adminDb.runTransaction(async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists) throw new ValidationError('Team not found.', 404);

    const data = teamDoc.data()!;
    const newMistakes = (data.mistakes || 0) + 1;
    const isDisqualified = newMistakes >= 3;

    transaction.update(teamRef, {
      mistakes: newMistakes,
      isDisqualified,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      teamId,
      mistakes: newMistakes,
      isDisqualified,
    };
  });
}

export async function reversePenaltyTransaction(teamId: string): Promise<PenaltyResult> {
  const teamRef = adminDb.collection('teams').doc(teamId);

  return await adminDb.runTransaction(async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists) throw new ValidationError('Team not found.', 404);

    const data = teamDoc.data()!;
    const currentMistakes = data.mistakes || 0;
    if (currentMistakes <= 0) {
      return {
        teamId,
        mistakes: 0,
        isDisqualified: false,
      };
    }

    const newMistakes = currentMistakes - 1;
    const isDisqualified = newMistakes >= 3;

    transaction.update(teamRef, {
      mistakes: newMistakes,
      isDisqualified,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      teamId,
      mistakes: newMistakes,
      isDisqualified,
    };
  });
}
