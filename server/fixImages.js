const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Levenshtein distance
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
  const players = await prisma.player.findMany();
  const dbNames = Array.from(new Set(players.map(p => p.name)));
  
  const photosDir = '../client/public/players';
  const photos = fs.readdirSync(photosDir).filter(f => {
    const ext = f.toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp');
  });
  
  const photoMap = {};
  
  // Directly map the filename (ignoring extension) to the photo URL
  for (const photo of photos) {
    const cleanPhotoName = photo.split('.')[0].toLowerCase().replace(/[^a-z]/g, '');
    photoMap[cleanPhotoName] = `/players/${photo}`;
  }
  
  // Also map existing DB names using fuzzy matching
  for (const dbName of dbNames) {
    const cleanDbName = dbName.toLowerCase().replace(/[^a-z]/g, '');
    
    let bestMatch = null;
    let minDistance = Infinity;
    
    for (const photo of photos) {
      const cleanPhotoName = photo.split('.')[0].toLowerCase().replace(/[^a-z]/g, '');
      const dist = levenshtein(cleanDbName, cleanPhotoName);
      
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = photo;
      }
    }
    
    // Threshold to prevent completely wrong matches
    if (minDistance <= 4) {
      photoMap[cleanDbName] = `/players/${bestMatch}`;
    }
  }
  
  console.log(`Matched ${Object.keys(photoMap).length} out of ${dbNames.length} unique DB players.`);
  
  fs.writeFileSync('../client/src/playerImageMap.json', JSON.stringify(photoMap, null, 2));
  
  // Now update the DB
  let updatedCount = 0;
  for (const p of players) {
    const cleanName = p.name.toLowerCase().replace(/[^a-z]/g, '');
    const img = photoMap[cleanName] || null;
    if (img !== p.imageUrl) {
      await prisma.player.update({
        where: { id: p.id },
        data: { imageUrl: img }
      });
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} player records in DB.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
