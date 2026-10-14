const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.bid.deleteMany();
  await prisma.player.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.location.deleteMany();

  // Create Locations
  const locations = await Promise.all([
    prisma.location.create({ data: { name: 'Mumbai' } }),
    prisma.location.create({ data: { name: 'Delhi' } }),
    prisma.location.create({ data: { name: 'Bangalore' } }),
    prisma.location.create({ data: { name: 'Chennai' } }),
  ]);

  // Create Admin User
  await prisma.user.create({
    data: {
      username: 'admin',
      password: 'password', // Not using hash for local testing
      role: 'ADMIN'
    }
  });

  // Create Teams and Auctioneers per location
  const teamNames = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];
  
  for (const loc of locations) {
    // 1. Create Auctioneer
    await prisma.user.create({
      data: {
        username: `auctioneer_${loc.name.toLowerCase()}`,
        password: 'password',
        role: 'AUCTIONEER',
        locationId: loc.id
      }
    });

    // 2. Create Teams for this location
    const teams = await Promise.all(
      teamNames.map(name => prisma.team.create({ 
        data: { name, budget: 900000000, locationId: loc.id } 
      }))
    );

    // 3. Create Team Leaders for these teams
    for (const team of teams) {
      await prisma.user.create({
        data: {
          username: `owner_${team.name.toLowerCase()}_${loc.name.toLowerCase()}`,
          password: 'password',
          role: 'TEAM_LEADER',
          teamId: team.id
        }
      });
    }
  }

  // Create some dummy players for Mumbai location
  const categories = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];
  const players = [];
  for (let i = 1; i <= 50; i++) {
    players.push({
      name: `Player ${i}`,
      category: categories[i % 4],
      basePrice: (i % 5 + 1) * 10000000, // 1Cr to 5Cr
      locationId: locations[0].id, // Default to Mumbai
      points: Math.floor(Math.random() * 100)
    });
  }
  
  await prisma.player.createMany({ data: players });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
