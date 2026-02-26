/**
 * FIX AGRESIVO DE TIMESTAMPS CORRUPTOS
 *
 * El problema: algunos timestamps tienen caracteres que Prisma no puede convertir a Date
 * Solución: Leer con raw, identificar los corruptos, y eliminarlos
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(50));
  console.log("FIX AGRESIVO DE TIMESTAMPS CORRUPTOS");
  console.log("=".repeat(50));

  // 1. Contar total
  const beforeCount = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM TickData`;
  console.log(`\n📊 Total ticks: ${beforeCount[0].count}`);

  // 2. Encontrar timestamps que no son ISO válidos
  // Un timestamp ISO válido tiene formato: YYYY-MM-DDTHH:MM:SS.sssZ
  console.log("\n🔍 Buscando timestamps no ISO...");

  const invalidTs = await prisma.$queryRaw<[{ id: number; timestamp: string }[]]>`
    SELECT id, timestamp FROM TickData
    WHERE length(timestamp) < 20
       OR length(timestamp) > 30
       OR substr(timestamp, 1, 4) NOT IN ('2024', '2025', '2026')
       OR timestamp NOT LIKE '%T%'
    LIMIT 1000
  `;

  console.log(`   Encontrados ${invalidTs.length} con formato sospechoso`);

  if (invalidTs.length > 0) {
    console.log("\n📋 Ejemplos:");
    invalidTs.slice(0, 20).forEach((t) => {
      console.log(`   ID ${t.id}: "${t.timestamp}" (len: ${t.timestamp.length})`);
    });

    // 3. Eliminar los corruptos
    console.log("\n🧹 Eliminando registros corruptos...");

    // Obtener IDs a eliminar
    const idsToDelete = invalidTs.map((t) => t.id);

    if (idsToDelete.length > 0) {
      // Eliminar en lotes pequeños
      const batchSize = 100;
      let deleted = 0;

      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const deletedCount = await prisma.$executeRawUnsafe(
          `DELETE FROM TickData WHERE id IN (${batch.join(",")})`
        );
        deleted += deletedCount;
      }

      console.log(`   Eliminados: ${deleted}`);
    }
  }

  // 4. Buscar más registros problemáticos con caracteres extraños
  console.log("\n🔍 Buscando caracteres inválidos en timestamps...");

  const weirdChars = await prisma.$queryRaw<[{ id: number; timestamp: string }[]]>`
    SELECT id, timestamp FROM TickData
    WHERE timestamp LIKE '%[^0-9T:-]%'
       OR timestamp LIKE '% %.%'
       OR instr(timestamp, char(10)) > 0
       OR instr(timestamp, char(13)) > 0
    LIMIT 1000
  `;

  console.log(`   Encontrados ${weirdChars.length} con caracteres extraños`);

  if (weirdChars.length > 0) {
    console.log("\n📋 Ejemplos:");
    weirdChars.slice(0, 10).forEach((t) => {
      console.log(`   ID ${t.id}: "${t.timestamp}"`);
    });

    // Eliminar
    const idsToDelete = weirdChars.map((t) => t.id);
    if (idsToDelete.length > 0) {
      const deletedCount = await prisma.$executeRawUnsafe(
        `DELETE FROM TickData WHERE id IN (${idsToDelete.join(",")})`
      );
      console.log(`   Eliminados: ${deletedCount}`);
    }
  }

  // 5. Contar después
  const afterCount = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM TickData`;
  console.log(`\n📊 Ticks después: ${afterCount[0].count}`);
  console.log(`📉 Eliminados: ${Number(beforeCount[0].count) - Number(afterCount[0].count)}`);

  // 6. VACUUM
  console.log("\n🔧 VACUUM...");
  await prisma.$executeRawUnsafe(`VACUUM`);
  console.log("   ✅ Done");

  // 7. Verificar lectura
  console.log("\n✅ Verificando lectura...");
  try {
    const first = await prisma.tickData.findFirst({
      where: { symbol: "XAUUSD" },
      orderBy: { timestamp: "asc" },
    });
    console.log(`   Primero: ${first?.timestamp.toISOString()}`);

    const last = await prisma.tickData.findFirst({
      where: { symbol: "XAUUSD" },
      orderBy: { timestamp: "desc" },
    });
    console.log(`   Último: ${last?.timestamp.toISOString()}`);

    console.log("\n✅ LECTURA CORRECTA");
  } catch (e) {
    console.log("   ❌ Aún hay problemas:", e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
