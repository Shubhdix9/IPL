const fs = require('fs');
const path = require('path');
const { db, admin } = require('./firestore-adapter');

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seed() {
  console.log('--- Starting Firebase Seed for IPL Auction Pro ---');

  // 1. Wipe collections
  console.log('Cleaning existing collections...');
  await deleteCollection('audit_logs');
  await deleteCollection('bids');
  await deleteCollection('players');
  await deleteCollection('teams');
  await deleteCollection('locations');
  await deleteCollection('users');

  const now = admin.firestore.FieldValue.serverTimestamp();

  // 2. Create Admin user
  console.log('Creating Admin User...');
  const adminRef = db.collection('users').doc('admin_user');
  await adminRef.set({
    uid: 'admin_user',
    username: 'admin',
    email: 'admin@iplauction.local',
    role: 'ADMIN',
    isActive: true,
    passwordFallback: 'password',
    createdAt: now,
    updatedAt: now,
  });

  // 3. Create Exactly ONE Authoritative Venue (Single Venue Architecture)
  console.log('Creating Single Authoritative Auction Venue...');
  const mainLocRef = db.collection('locations').doc('main_arena');
  const mainLocData = {
    name: 'IPL Mega Auction Arena 2026',
    city: 'BCCI National Command Arena',
    isOnBreak: false,
    leaderboardVisible: false,
    activePlayerId: null,
    auctionStatus: 'UPCOMING',
    timerDeadlineMs: null,
    timerDurationSeconds: 30,
    timerPaused: false,
    timerRemainingMs: null,
    createdAt: now,
    updatedAt: now,
  };
  await mainLocRef.set(mainLocData);

  // Auctioneer User
  const aucRef = db.collection('users').doc('user_auctioneer');
  await aucRef.set({
    uid: aucRef.id,
    username: 'auctioneer',
    email: 'auctioneer@iplauction.local',
    role: 'AUCTIONEER',
    locationId: 'main_arena',
    isActive: true,
    passwordFallback: 'password',
    createdAt: now,
    updatedAt: now,
  });

  // 4. Create the 10 Official IPL Franchises
  const teamMeta = {
    CSK: { name: 'Chennai Super Kings', short: 'CSK', color: '#f9cd05', city: 'Chennai' },
    MI: { name: 'Mumbai Indians', short: 'MI', color: '#004ba0', city: 'Mumbai' },
    RCB: { name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#d32f2f', city: 'Bengaluru' },
    DC: { name: 'Delhi Capitals', short: 'DC', color: '#2563eb', city: 'Delhi' },
    KKR: { name: 'Kolkata Knight Riders', short: 'KKR', color: '#3a225d', city: 'Kolkata' },
    PBKS: { name: 'Punjab Kings', short: 'PBKS', color: '#ed1b24', city: 'Mohali' },
    RR: { name: 'Rajasthan Royals', short: 'RR', color: '#eb178b', city: 'Jaipur' },
    SRH: { name: 'Sunrisers Hyderabad', short: 'SRH', color: '#ff6200', city: 'Hyderabad' },
    LSG: { name: 'Lucknow Super Giants', short: 'LSG', color: '#00a3e0', city: 'Lucknow' },
    GT: { name: 'Gujarat Titans', short: 'GT', color: '#1b2133', city: 'Ahmedabad' }
  };

  console.log('Creating 10 Official IPL Franchises...');
  for (const [code, meta] of Object.entries(teamMeta)) {
    const teamId = `team_${code.toLowerCase()}_main`;
    const teamRef = db.collection('teams').doc(teamId);
    await teamRef.set({
      name: meta.name,
      shortName: meta.short,
      franchiseCode: code,
      color: meta.color,
      city: meta.city,
      locationId: 'main_arena',
      budget: 900_000_000,
      initialBudget: 900_000_000,
      mistakes: 0,
      isDisqualified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create manager credentials: short code (e.g. csk) and owner_ (e.g. owner_csk)
    const logins = [code.toLowerCase(), `owner_${code.toLowerCase()}`];
    for (const uname of logins) {
      const leaderRef = db.collection('users').doc(`user_${uname}`);
      await leaderRef.set({
        uid: leaderRef.id,
        username: uname,
        email: `${uname}@iplauction.local`,
        role: 'TEAM_LEADER',
        teamId: teamRef.id,
        locationId: 'main_arena',
        isActive: true,
        passwordFallback: 'password',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 5. Seed Real Players (All 211 unique players directly into main_arena)
  console.log('Seeding 211 Unique Players into the Single Arena...');
  const mapPath = path.resolve(__dirname, '../client/src/playerImageMap.json');
  let imageMap = {};
  if (fs.existsSync(mapPath)) {
    imageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }

  const all211Path = path.resolve(__dirname, 'scratch/all_211_players.json');
  let samplePlayers = [];
  if (fs.existsSync(all211Path)) {
    samplePlayers = JSON.parse(fs.readFileSync(all211Path, 'utf8'));
  }

  const batch = db.batch();
  for (let i = 0; i < samplePlayers.length; i++) {
    const p = samplePlayers[i];
    const pId = `p_main_${i + 1}`;
    const pRef = db.collection('players').doc(pId);
    const nameKey = p.name.toLowerCase().replace(/[^a-z]/g, '');
    const imageUrl = imageMap[nameKey] || p.imageUrl || `/players/${nameKey}.png.png`;

    batch.set(pRef, {
      name: p.name,
      category: p.category,
      basePrice: p.basePrice || 20_000_000,
      points: p.points || 85,
      pool: p.pool || 'POOL-1',
      country: p.country || 'IND',
      imageUrl,
      locationId: 'main_arena',
      status: 'UPCOMING',
      currentBid: null,
      currentBidTeamId: null,
      currentBidId: null,
      soldPrice: null,
      teamId: null,
      order: i + 1,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();

  console.log(`✅ Single Arena Seeding Complete!`);
  console.log(`- Created 1 authoritative venue: IPL Mega Auction Arena 2026`);
  console.log(`- Created all 10 franchises competing in the same arena with ₹90 Cr purse`);
  console.log(`- Created admin, auctioneer, and manager logins for all 10 teams`);
  console.log(`- Seeded all 211 unique players once (no venue duplication)`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
