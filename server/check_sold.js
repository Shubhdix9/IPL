const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const soldPlayers = await prisma.player.findMany({
    where: { status: 'SOLD' },
    include: { team: true, location: true }
  });
  console.log(`There are ${soldPlayers.length} SOLD players currently in the database.`);
  if (soldPlayers.length > 0) {
    console.log("Sample sold player:");
    console.log(soldPlayers[0]);
  }
}
main().finally(() => prisma.$disconnect());
