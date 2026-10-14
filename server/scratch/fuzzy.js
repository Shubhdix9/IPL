const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
  const players = await prisma.player.findMany({ where: { imageUrl: null } });
  const files = fs.readdirSync('../client/public/players').filter(f => f.endsWith('.png'));
  
  // Find all used files currently
  const usedPlayers = await prisma.player.findMany({ where: { imageUrl: { not: null } } });
  const usedFiles = usedPlayers.map(p => p.imageUrl.split('/').pop());
  
  const unusedFiles = files.filter(f => !usedFiles.includes(f));
  
  console.log('Unused files count:', unusedFiles.length);
  
  let updated = 0;
  for (const p of players) {
    const parts = p.name.toLowerCase().split(' ');
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    
    let bestMatch = null;
    for (const f of unusedFiles) {
       const fLower = f.toLowerCase();
       // Check if parts match
       if ((fLower.includes(lastName) && lastName.length > 3) || (fLower.includes(firstName) && firstName.length > 3)) {
          bestMatch = f;
          break;
       }
    }
    
    if (bestMatch) {
       const mappedUrl = '/players/' + bestMatch;
       await prisma.player.update({
         where: { id: p.id },
         data: { imageUrl: mappedUrl }
       });
       console.log('Fuzzy matched:', p.name, '->', bestMatch);
       unusedFiles.splice(unusedFiles.indexOf(bestMatch), 1);
       updated++;
    }
  }
  console.log('Total fuzzy updated:', updated);
  await prisma.$disconnect();
}
run().catch(console.error);
