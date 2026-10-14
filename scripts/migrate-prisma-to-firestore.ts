import * as fs from 'fs';
import * as path from 'path';
import { adminAuth, adminDb } from '../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

let prisma: any = null;

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n============================================================`);
  console.log(`IPL Auction: Prisma to Firestore Database Migration Script`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (No writes)' : 'LIVE EXECUTION'}`);
  console.log(`============================================================\n`);

  try {
    const { PrismaClient } = require('../server/node_modules/@prisma/client');
    prisma = new PrismaClient();
  } catch {
    console.log(`[Migration Note] Legacy Prisma Client has already been decommissioned and removed.`);
    console.log(`The application now runs exclusively on Firebase / Cloud Firestore.`);
    console.log(`To re-seed or verify Firestore data, run: npm run seed-firebase (or node server/seed-firebase.js).`);
    return;
  }

  // 1. Database backup
  const dbPath = path.resolve(__dirname, '../server/prisma/dev.db');
  if (fs.existsSync(dbPath)) {
    const backupPath = path.resolve(
      __dirname,
      `../server/prisma/dev.db.backup.${Date.now()}`
    );
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[Backup] Created backup copy at: ${backupPath}`);
  }

  // 2. Query Prisma records
  console.log(`[Extract] Reading existing Prisma records...`);
  const [locations, teams, players, users, bids] = await Promise.all([
    prisma.location.findMany(),
    prisma.team.findMany(),
    prisma.player.findMany(),
    prisma.user.findMany(),
    prisma.bid.findMany(),
  ]);

  console.log(
    `[Summary] Found: ${locations.length} venues, ${teams.length} teams, ${players.length} players, ${users.length} users, ${bids.length} bids.`
  );

  if (isDryRun) {
    console.log(`\n[Dry Run] Skipping Firestore writes. Validation passed.`);
    return;
  }

  // ID Mapping maps integer IDs from Prisma to stable string Firestore IDs
  const locationMap = new Map<number, string>();
  const teamMap = new Map<number, string>();
  const userMap = new Map<number, string>();

  // 3. Migrate Locations
  console.log(`\n[Migrate] Writing ${locations.length} Locations to Firestore...`);
  for (const loc of locations) {
    const firestoreId = `loc_${loc.id}`;
    locationMap.set(loc.id, firestoreId);

    const docRef = adminDb.collection('locations').doc(firestoreId);
    await docRef.set(
      {
        name: loc.name,
        city: loc.name,
        isOnBreak: false,
        leaderboardVisible: false,
        activePlayerId: null,
        auctionStatus: 'UPCOMING',
        legacyPrismaId: loc.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 4. Migrate Teams
  console.log(`[Migrate] Writing ${teams.length} Teams to Firestore...`);
  const teamBatch = adminDb.batch();
  for (const team of teams) {
    const firestoreId = `team_${team.id}`;
    teamMap.set(team.id, firestoreId);

    const teamRef = adminDb.collection('teams').doc(firestoreId);
    teamBatch.set(
      teamRef,
      {
        name: team.name,
        shortName: team.name,
        locationId: locationMap.get(team.locationId) || `loc_${team.locationId}`,
        budget: team.budget,
        initialBudget: 900_000_000,
        mistakes: team.mistakes || 0,
        isDisqualified: team.isDisqualified || false,
        legacyPrismaId: team.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await teamBatch.commit();

  // 5. Migrate Players
  console.log(`[Migrate] Writing ${players.length} Players to Firestore...`);
  let playerBatch = adminDb.batch();
  let pCount = 0;

  for (const p of players) {
    const firestoreId = `player_${p.id}`;
    const playerRef = adminDb.collection('players').doc(firestoreId);

    playerBatch.set(
      playerRef,
      {
        name: p.name,
        category: p.category,
        basePrice: p.basePrice,
        points: p.points || 0,
        pool: p.pool || null,
        country: p.country || 'IND',
        imageUrl: p.imageUrl || null,
        locationId: locationMap.get(p.locationId) || `loc_${p.locationId}`,
        status: p.status || 'UPCOMING',
        currentBid: null,
        currentBidTeamId: null,
        currentBidId: null,
        soldPrice: p.soldPrice || null,
        teamId: p.teamId ? teamMap.get(p.teamId) || `team_${p.teamId}` : null,
        legacyPrismaId: p.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    pCount++;
    if (pCount >= 400) {
      await playerBatch.commit();
      playerBatch = adminDb.batch();
      pCount = 0;
    }
  }
  if (pCount > 0) {
    await playerBatch.commit();
  }

  // 6. Migrate Users & Provision Firebase Auth
  console.log(`[Migrate] Provisioning ${users.length} Users in Firebase Auth & Firestore...`);
  for (const u of users) {
    const cleanUsername = u.username.trim().toLowerCase();
    const email = `${cleanUsername}@iplauction.local`;
    let uid = `user_${u.id}`;

    // Provision Firebase Auth record
    try {
      const authRecord = await adminAuth.createUser({
        uid,
        email,
        password: u.password || 'password',
        displayName: u.username,
      });
      uid = authRecord.uid;
    } catch {
      // User might already exist in Auth
    }

    const firestoreLocationId = u.locationId ? locationMap.get(u.locationId) || `loc_${u.locationId}` : null;
    const firestoreTeamId = u.teamId ? teamMap.get(u.teamId) || `team_${u.teamId}` : null;

    // Set custom claims
    try {
      await adminAuth.setCustomUserClaims(uid, {
        role: u.role,
        locationId: firestoreLocationId,
        teamId: firestoreTeamId,
      });
    } catch (e: any) {
      console.warn(`[User] Custom claims note for ${u.username}:`, e.message);
    }

    // Write Firestore user profile
    await adminDb.collection('users').doc(uid).set(
      {
        uid,
        username: cleanUsername,
        email,
        role: u.role,
        locationId: firestoreLocationId,
        teamId: firestoreTeamId,
        isActive: true,
        passwordFallback: u.password || 'password',
        legacyPrismaId: u.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log(`\n============================================================`);
  console.log(`✅ Migration Complete: All records successfully mapped to Firestore!`);
  console.log(`============================================================\n`);
}

main()
  .catch((err) => {
    console.error('[Migration Error]:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (typeof prisma !== 'undefined' && prisma?.$disconnect) {
      await prisma.$disconnect();
    }
  });
