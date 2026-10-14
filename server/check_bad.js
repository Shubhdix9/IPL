const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany();
  const nullCategory = players.filter(p => !p.category);
  console.log('Players with null category:', nullCategory.length);

  const nullName = players.filter(p => !p.name);
  console.log('Players with null name:', nullName.length);

  const nullPrice = players.filter(p => p.status === 'SOLD' && !p.soldPrice);
  console.log('Sold players with null soldPrice:', nullPrice.length);
}
main().finally(() => { prisma.$disconnect(); });
