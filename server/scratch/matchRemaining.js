const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

async function main() {
  const players = await prisma.player.findMany({ where: { imageUrl: null } });
  let unmappedPlayers = Array.from(new Set(players.map(p => p.name)));
  
  const mappedPlayers = await prisma.player.findMany({ where: { imageUrl: { not: null } } });
  const mappedPhotos = new Set(mappedPlayers.map(p => p.imageUrl.replace('/players/', '')));
  
  const allPhotos = fs.readdirSync('../client/public/players').filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  const unmappedPhotos = allPhotos.filter(f => !mappedPhotos.has(f));
  
  const manualMatches = {
    'yuzi_chahal.png.png': 'YUZVENDRA CHAHAL',
    'md_nabi.png': 'MOHAMMAD NABI', // Though he might not be in the unmapped list? Let's check below.
    'shimron_hetmyer.png': 'SHIMRON HETMYER'
  };

  const newMappings = {};
  
  for (const photo of unmappedPhotos) {
    const cleanPhotoName = photo.split('.')[0].toLowerCase().replace(/[^a-z]/g, '');
    let bestMatch = null;
    let minDistance = Infinity;
    
    for (const player of unmappedPlayers) {
      const cleanDbName = player.toLowerCase().replace(/[^a-z]/g, '');
      
      // If photo contains part of player name or vice versa
      if (cleanPhotoName.includes(cleanDbName) || cleanDbName.includes(cleanPhotoName)) {
        minDistance = 0;
        bestMatch = player;
        break;
      }
      
      const dist = levenshtein(cleanDbName, cleanPhotoName);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = player;
      }
    }
    
    if (manualMatches[photo]) {
      bestMatch = manualMatches[photo];
    }
    
    console.log(`Matched photo '${photo}' to player '${bestMatch}' (Distance: ${minDistance})`);
    
    // Assign mapping
    newMappings[bestMatch] = `/players/${photo}`;
    
    // Remove player from pool to prevent double matching
    unmappedPlayers = unmappedPlayers.filter(p => p !== bestMatch);
  }
  
  // Apply mappings to DB
  let updatedCount = 0;
  for (const p of players) {
    if (newMappings[p.name]) {
      await prisma.player.update({
        where: { id: p.id },
        data: { imageUrl: newMappings[p.name] }
      });
      updatedCount++;
    }
  }
  
  console.log(`\nUpdated ${updatedCount} player records with the remaining photos.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
