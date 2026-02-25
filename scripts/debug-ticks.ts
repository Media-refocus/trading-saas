import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debug() {
  console.log("=== DEBUG TICKS ===\n");

  // Contar total
  const count = await prisma.tickData.count();
  console.log(`📊 Total ticks: ${count.toLocaleString()}`);

  // Primer y último
  const first = await prisma.tickData.findFirst({ orderBy: { timestamp: "asc" } });
  const last = await prisma.tickData.findFirst({ orderBy: { timestamp: "desc" } });

  console.log(`📅 Primer tick: ${first?.timestamp} (${typeof first?.timestamp})`);
  console.log(`📅 Último tick: ${last?.timestamp} (${typeof last?.timestamp})`);

  // Muestra de ticks recientes
  console.log("\n📋 Muestra de 5 ticks más recientes:");
  const recent = await prisma.tickData.findMany({
    take: 5,
    orderBy: { timestamp: "desc" },
  });

  for (const t of recent) {
    console.log(`   ${t.timestamp.toISOString()} | bid: ${t.bid} | ask: ${t.ask}`);
  }

  // Contar por año
  const year2024 = await prisma.tickData.count({
    where: {
      timestamp: {
        gte: new Date("2024-01-01"),
        lt: new Date("2025-01-01"),
      },
    },
  });

  const year2025 = await prisma.tickData.count({
    where: {
      timestamp: {
        gte: new Date("2025-01-01"),
        lt: new Date("2026-01-01"),
      },
    },
  });

  const year2026 = await prisma.tickData.count({
    where: {
      timestamp: {
        gte: new Date("2026-01-01"),
        lt: new Date("2027-01-01"),
      },
    },
  });

  console.log("\n📊 Por año:");
  console.log(`   2024: ${year2024.toLocaleString()}`);
  console.log(`   2025: ${year2025.toLocaleString()}`);
  console.log(`   2026: ${year2026.toLocaleString()}`);

  await prisma.$disconnect();
}

debug().catch(console.error);
