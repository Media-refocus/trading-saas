import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Query raw para agrupar por mes
  const byMonth = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT strftime('%Y-%m', timestamp) as month, COUNT(*) as count
    FROM TickData
    GROUP BY month
    ORDER BY month
  `;

  console.log("\n📊 TICKS POR MES:\n");
  let total = BigInt(0);
  for (const row of byMonth) {
    console.log(`  ${row.month}: ${row.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);
    total += row.count;
  }
  console.log(`\n  TOTAL: ${total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
