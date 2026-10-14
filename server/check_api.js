const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const teams = await prisma.team.findMany({ include: { players: true } });
  const pbks = teams.find(t => t.id === 46);
  console.log(`Team PBKS has ${pbks.players.length} players.`);
  if (pbks.players.length > 0) {
    console.log(pbks.players[0].name);
  }
}
main().finally(() => prisma.$disconnect());
