const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.player.findMany({ select: { category: true }, distinct: ['category'] });
  console.log(cats);
}
main().finally(() => { prisma.$disconnect(); });
