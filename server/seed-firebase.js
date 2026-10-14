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

  // 3. Create Locations
  console.log('Creating Venues...');
  const venues = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'];
  const locationDocs = [];

  for (const name of venues) {
    const locRef = db.collection('locations').doc(`loc_${name.toLowerCase()}`);
    const data = {
      name,
      city: name,
      isOnBreak: false,
      leaderboardVisible: false,
      activePlayerId: null,
      auctionStatus: 'UPCOMING',
      createdAt: now,
      updatedAt: now,
    };
    await locRef.set(data);
    locationDocs.push({ id: locRef.id, ...data });
  }

  // 4. Create Teams and Team Leaders
  const teamNames = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];
  console.log('Creating Teams and Franchise Leaders...');

  for (const loc of locationDocs) {
    // Auctioneer for location
    const aucUsername = `auctioneer_${loc.name.toLowerCase()}`;
    const aucRef = db.collection('users').doc(`user_${aucUsername}`);
    await aucRef.set({
      uid: aucRef.id,
      username: aucUsername,
      email: `${aucUsername}@iplauction.local`,
      role: 'AUCTIONEER',
      locationId: loc.id,
      isActive: true,
      passwordFallback: 'password',
      createdAt: now,
      updatedAt: now,
    });

    // 10 Teams
    for (const tName of teamNames) {
      const teamId = `team_${tName.toLowerCase()}_${loc.name.toLowerCase()}`;
      const teamRef = db.collection('teams').doc(teamId);
      await teamRef.set({
        name: tName,
        shortName: tName,
        locationId: loc.id,
        budget: 900_000_000,
        initialBudget: 900_000_000,
        mistakes: 0,
        isDisqualified: false,
        createdAt: now,
        updatedAt: now,
      });

      const leaderUsername = `owner_${tName.toLowerCase()}_${loc.name.toLowerCase()}`;
      const leaderRef = db.collection('users').doc(`user_${leaderUsername}`);
      await leaderRef.set({
        uid: leaderRef.id,
        username: leaderUsername,
        email: `${leaderUsername}@iplauction.local`,
        role: 'TEAM_LEADER',
        teamId: teamRef.id,
        locationId: loc.id,
        isActive: true,
        passwordFallback: 'password',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 5. Seed Real Players from playerImageMap.json
  console.log('Seeding Players...');
  const mapPath = path.resolve(__dirname, '../client/src/playerImageMap.json');
  let imageMap = {};
  if (fs.existsSync(mapPath)) {
    imageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }

  const samplePlayers = [
    { name: 'Virat Kohli', category: 'BATSMAN', basePrice: 20_000_000, pool: 'POOL-1 Marquee Batsman', points: 95, country: 'IND' },
    { name: 'Rohit Sharma', category: 'BATSMAN', basePrice: 20_000_000, pool: 'POOL-1 Marquee Batsman', points: 92, country: 'IND' },
    { name: 'Jasprit Bumrah', category: 'BOWLER', basePrice: 20_000_000, pool: 'POOL-2 Marquee Bowler', points: 98, country: 'IND' },
    { name: 'Hardik Pandya', category: 'ALL_ROUNDER', basePrice: 20_000_000, pool: 'POOL-3 Marquee All-Rounder', points: 90, country: 'IND' },
    { name: 'Rishabh Pant', category: 'WICKET_KEEPER', basePrice: 20_000_000, pool: 'POOL-4 Marquee Wicket-Keeper', points: 91, country: 'IND' },
    { name: 'Travis Head', category: 'BATSMAN', basePrice: 20_000_000, pool: 'POOL-1 Marquee Batsman', points: 89, country: 'AUS' },
    { name: 'Pat Cummins', category: 'BOWLER', basePrice: 20_000_000, pool: 'POOL-2 Marquee Bowler', points: 92, country: 'AUS' },
    { name: 'Mitchell Starc', category: 'BOWLER', basePrice: 20_000_000, pool: 'POOL-2 Marquee Bowler', points: 91, country: 'AUS' },
    { name: 'Heinrich Klaasen', category: 'WICKET_KEEPER', basePrice: 15_000_000, pool: 'POOL-4 Marquee Wicket-Keeper', points: 93, country: 'SA' },
    { name: 'Nicholas Pooran', category: 'WICKET_KEEPER', basePrice: 15_000_000, pool: 'POOL-4 Marquee Wicket-Keeper', points: 88, country: 'WI' },
    { name: 'Rashid Khan', category: 'BOWLER', basePrice: 20_000_000, pool: 'POOL-2 Marquee Bowler', points: 96, country: 'AFG' },
    { name: 'Sunil Narine', category: 'ALL_ROUNDER', basePrice: 15_000_000, pool: 'POOL-3 Marquee All-Rounder', points: 94, country: 'WI' },
    { name: 'Andre Russell', category: 'ALL_ROUNDER', basePrice: 20_000_000, pool: 'POOL-3 Marquee All-Rounder', points: 93, country: 'WI' },
    { name: 'Shubman Gill', category: 'BATSMAN', basePrice: 20_000_000, pool: 'POOL-1 Marquee Batsman', points: 90, country: 'IND' },
    { name: 'Yashasvi Jaiswal', category: 'BATSMAN', basePrice: 15_000_000, pool: 'POOL-1 Marquee Batsman', points: 89, country: 'IND' },
    { name: 'Suryakumar Yadav', category: 'BATSMAN', basePrice: 20_000_000, pool: 'POOL-1 Marquee Batsman', points: 94, country: 'IND' },
    { name: 'Ravindra Jadeja', category: 'ALL_ROUNDER', basePrice: 20_000_000, pool: 'POOL-3 Marquee All-Rounder', points: 92, country: 'IND' },
    { name: 'Mohammed Siraj', category: 'BOWLER', basePrice: 15_000_000, pool: 'POOL-2 Marquee Bowler', points: 86, country: 'IND' },
    { name: 'Arshdeep Singh', category: 'BOWLER', basePrice: 15_000_000, pool: 'POOL-2 Marquee Bowler', points: 88, country: 'IND' },
    { name: 'Yuzvendra Chahal', category: 'BOWLER', basePrice: 15_000_000, pool: 'POOL-2 Marquee Bowler', points: 89, country: 'IND' },
  ];

  // Distribute players across venues
  for (const loc of locationDocs) {
    const batch = db.batch();
    for (let i = 0; i < samplePlayers.length; i++) {
      const p = samplePlayers[i];
      const pId = `p_${loc.name.toLowerCase()}_${i + 1}`;
      const pRef = db.collection('players').doc(pId);
      const nameKey = p.name.toLowerCase().replace(/[^a-z]/g, '');
      const imageUrl = imageMap[nameKey] || `/players/${nameKey}.png.png`;

      batch.set(pRef, {
        name: p.name,
        category: p.category,
        basePrice: p.basePrice,
        points: p.points,
        pool: p.pool,
        country: p.country,
        imageUrl,
        locationId: loc.id,
        status: 'UPCOMING',
        currentBid: null,
        currentBidTeamId: null,
        currentBidId: null,
        soldPrice: null,
        teamId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  console.log(`✅ Seeding Complete!`);
  console.log(`- Created ${locationDocs.length} venues`);
  console.log(`- Created ${locationDocs.length * teamNames.length} franchise teams with ₹90 Cr budgets`);
  console.log(`- Created Admin and ${locationDocs.length * (teamNames.length + 1)} user accounts`);
  console.log(`- Seeded ${samplePlayers.length * locationDocs.length} players with photos and stats`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
