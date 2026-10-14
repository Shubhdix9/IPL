const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const mapPath = path.join(__dirname, '../../client/src/playerImageMap.json');
const playerImageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

async function updateMissingImages() {
  const players = await prisma.player.findMany({ where: { imageUrl: null } });
  console.log('Found', players.length, 'players with null imageUrl in DB');
  let updated = 0;
  for (const p of players) {
    const nameKey = p.name.toLowerCase().replace(/[^a-z]/g, '');
    const mappedUrl = playerImageMap[nameKey];
    if (mappedUrl) {
      await prisma.player.update({
        where: { id: p.id },
        data: { imageUrl: mappedUrl }
      });
      updated++;
      console.log('Updated DB image for:', p.name, '->', mappedUrl);
    } else {
      console.log('Still no mapping found for:', p.name);
    }
  }
  console.log('Total DB rows updated:', updated);
  await prisma.$disconnect();
}
updateMissingImages().catch(console.error);
