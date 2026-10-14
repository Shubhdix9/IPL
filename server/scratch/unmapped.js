const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({ where: { imageUrl: null } });
  const unmappedPlayers = Array.from(new Set(players.map(p => p.name)));
  
  const mappedPlayers = await prisma.player.findMany({ where: { imageUrl: { not: null } } });
  const mappedPhotos = new Set(mappedPlayers.map(p => p.imageUrl.replace('/players/', '')));
  
  const allPhotos = fs.readdirSync('../client/public/players').filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  const unmappedPhotos = allPhotos.filter(f => !mappedPhotos.has(f));
  
  console.log('--- Unmapped Players ---');
  console.log(unmappedPlayers.join('\n'));
  
  console.log('\n--- Unmapped Photos ---');
  console.log(unmappedPhotos.join('\n'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
