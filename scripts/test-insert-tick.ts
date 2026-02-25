import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("=== TEST DE INSERCIÓN DE TICKS ===\n");

  // Insertar un tick de prueba de 2026
  const testTick = {
    symbol: "XAUUSD",
    timestamp: new Date("2026-01-02T01:00:45.438Z"),
    bid: 4332.04,
    ask: 4332.21,
    spread: 17.0,
  };

  console.log("Insertando tick de prueba:", testTick);

  try {
    await prisma.$executeRaw`
      INSERT INTO TickData (symbol, timestamp, bid, ask, spread)
      VALUES (${testTick.symbol}, ${testTick.timestamp}, ${testTick.bid}, ${testTick.ask}, ${testTick.spread})
    `;
    console.log("✅ Inserción exitosa con SQL raw");
  } catch (error) {
    console.log("❌ Error con SQL raw:", error);
  }

  // Verificar
  const count2026 = await prisma.tickData.count({
    where: {
      timestamp: {
        gte: new Date("2026-01-01"),
        lt: new Date("2027-01-01"),
      },
    },
  });

  console.log(`\n📊 Ticks de 2026 después de inserción: ${count2026}`);

  // Ver todos los datos recientes
  const recent = await prisma.$queryRaw<Array<{ timestamp: Date; bid: number }>>`
    SELECT timestamp, bid FROM TickData ORDER BY timestamp DESC LIMIT 5
  `;

  console.log("\n📋 Últimos 5 ticks:");
  for (const r of recent) {
    console.log(`   ${r.timestamp.toISOString()} | bid: ${r.bid}`);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
