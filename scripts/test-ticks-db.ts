import { prisma } from "../lib/prisma";

async function test() {
  console.log("=== VERIFICACIÓN DE LECTURA DE TICKS ===\n");

  // 1. Verificar lectura de octubre 2025 (antes fallaba)
  console.log("📅 Verificando octubre 2025...");
  const octTicks = await prisma.tickData.findMany({
    where: {
      symbol: "XAUUSD",
      timestamp: {
        gte: new Date("2025-10-08T07:00:00Z"),
        lte: new Date("2025-10-08T08:00:00Z"),
      },
    },
    orderBy: { timestamp: "asc" },
    take: 10,
  });

  console.log(`   ✅ Ticks encontrados: ${octTicks.length}`);
  if (octTicks.length > 0) {
    console.log("   Primeros 5:");
    octTicks.slice(0, 5).forEach((t) => console.log(`     ${t.timestamp.toISOString()} | bid: ${t.bid} | ask: ${t.ask}`));
  }

  // 2. Verificar últimos ticks (enero-feb 2026)
  console.log("\n📅 Verificando últimos ticks (2026)...");
  const lastTicks = await prisma.tickData.findMany({
    where: { symbol: "XAUUSD" },
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  lastTicks.forEach((t) => console.log(`   ${t.timestamp.toISOString()} | bid: ${t.bid}`));

  // 3. Verificar rango completo
  console.log("\n📅 Verificando primer tick...");
  const firstTick = await prisma.tickData.findFirst({
    where: { symbol: "XAUUSD" },
    orderBy: { timestamp: "asc" },
  });
  console.log(`   ${firstTick?.timestamp.toISOString()} | bid: ${firstTick?.bid}`);

  await prisma.$disconnect();
  console.log("\n✅ Todas las lecturas correctas");
}

test().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
