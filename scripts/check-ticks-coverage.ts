import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  console.log("=== VERIFICACIÓN DE TICKS EN BD ===\n");

  const count = await prisma.tickData.count();
  const first = await prisma.tickData.findFirst({ orderBy: { timestamp: "asc" } });
  const last = await prisma.tickData.findFirst({ orderBy: { timestamp: "desc" } });

  console.log(`📊 Total ticks: ${count.toLocaleString()}`);
  console.log(`📅 Primer tick: ${first?.timestamp?.toISOString() || "N/A"}`);
  console.log(`📅 Último tick: ${last?.timestamp?.toISOString() || "N/A"}`);

  console.log("\n=== COBERTURA POR MES ===");

  const months = [
    { name: "Oct 2025", start: "2025-10-01", end: "2025-11-01" },
    { name: "Nov 2025", start: "2025-11-01", end: "2025-12-01" },
    { name: "Dic 2025", start: "2025-12-01", end: "2026-01-01" },
    { name: "Ene 2026", start: "2026-01-01", end: "2026-02-01" },
    { name: "Feb 2026", start: "2026-02-01", end: "2026-03-01" },
  ];

  for (const month of months) {
    const monthCount = await prisma.tickData.count({
      where: {
        timestamp: {
          gte: new Date(month.start),
          lt: new Date(month.end),
        },
      },
    });
    const icon = monthCount > 0 ? "✅" : "❌";
    console.log(`   ${icon} ${month.name}: ${monthCount.toLocaleString()} ticks`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
