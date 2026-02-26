import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Limpiando tabla TickData...");

  const before = await prisma.tickData.count();
  console.log(`   Ticks antes: ${before.toLocaleString()}`);

  await prisma.tickData.deleteMany({});
  await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name='TickData'`);

  const after = await prisma.tickData.count();
  console.log(`   Ticks después: ${after.toLocaleString()}`);

  // También vacuum para reducir tamaño
  console.log("   Ejecutando VACUUM...");
  await prisma.$executeRawUnsafe(`VACUUM`);

  console.log("✅ Tabla limpiada");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
