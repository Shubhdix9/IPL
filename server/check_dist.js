const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const sold = await prisma.player.groupBy({
    by: ['locationId', 'status'],
    where: { status: 'SOLD' },
    _count: { id: true }
  });
  console.log(sold);
}
main().finally(() => prisma.$disconnect());
