const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.player.updateMany({
    where: { name: 'YUZVENDRA CHAHAL' },
    data: { imageUrl: '/players/yuzi_chahal.png.png' }
  });
  console.log("Mapped Yuzi Chahal.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
