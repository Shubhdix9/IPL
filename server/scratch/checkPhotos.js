const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({ where: { imageUrl: null } });
  const names = Array.from(new Set(players.map(p => p.name)));
  
  if (names.length === 0) {
    console.log("SUCCESS: All players have photos matched!");
  } else {
    console.log(`WARNING: ${names.length} players are still missing photos:\n`);
    console.log(names.join('\n'));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
