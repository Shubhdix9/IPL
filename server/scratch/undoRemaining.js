const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const incorrectMappings = [
    'PAUL VELTHETY',
    'YASH THAKUR',
    'BRENDON KING',
    'HARRY BROOK',
    'ROHAN KADAM',
    'SHAUN MARSH',
    'SEAN ABOTT',
    'KRUNAL PANDAYA',
    'DEVON  CONVAY',
    'MARCO JANSEN',
    'MANAN WOHRA',
    'ROBIN MINZ',
    'DHRUV JUREL',
    'SIKNDAR RAZA',
    'ESHAN MALINGA',
    'SHAMAR JOSEPH',
    'AKASH DEEP',
    'KUMAR KUSHAGRA',
    'YUZVENDRA CHAHAL'
  ];
  
  await prisma.player.updateMany({
    where: {
      name: { in: incorrectMappings }
    },
    data: { imageUrl: null }
  });
  console.log("Reverted the forceful, inaccurate mappings.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
