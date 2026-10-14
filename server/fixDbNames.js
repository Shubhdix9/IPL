const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const map = JSON.parse(fs.readFileSync('../client/src/playerImageMap.json', 'utf8'));
  const players = await prisma.player.findMany();
  
  let updatedCount = 0;
  
  for (const p of players) {
    if (p.imageUrl) {
      // imageUrl looks like: "/players/adam_zampa.png"
      const filename = p.imageUrl.split('/').pop(); // "adam_zampa.png"
      const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg)$/i, ''); // "adam_zampa"
      
      // format to title case
      const correctName = nameWithoutExt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      // If the current DB name differs significantly from the correct name, let's update it.
      // E.g. "ABAM ZAMPA" != "Adam Zampa" (ignoring case)
      if (p.name.toLowerCase() !== correctName.toLowerCase()) {
        console.log(`Fixing typo: "${p.name}" -> "${correctName}"`);
        await prisma.player.update({
          where: { id: p.id },
          data: { name: correctName.toUpperCase() } // Storing in uppercase as it was previously for consistency, or we can just use the exact correctName
        });
        updatedCount++;
      }
    }
  }
  
  console.log(`Fixed spellings for ${updatedCount} player records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
