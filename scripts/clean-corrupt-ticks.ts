/**
 * LIMPIAR TICKS CORRUPTOS
 *
 * Identifica y elimina registros con timestamps inválidos
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(50));
  console.log("LIMPIEZA DE TICKS CORRUPTOS");
  console.log("=".repeat(50));

  // 1. Contar total antes
  const beforeCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM TickData
  `;
  console.log(`\n📊 Ticks antes: ${beforeCount[0].count}`);

  // 2. Identificar timestamps inválidos
  // Un timestamp válido debe coincidir con el patrón ISO: YYYY-MM-DDTHH:MM:SS
  console.log("\n🔍 Buscando registros con timestamps inválidos...");

  const invalidTimestamps = await prisma.$queryRaw<[{ id: number; timestamp: string }[]]>`
    SELECT id, timestamp FROM TickData
    WHERE typeof(timestamp) != 'text'
       OR timestamp NOT GLOB '*[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
    LIMIT 100
  `;

  console.log(`   Encontrados ${invalidTimestamps.length} registros con formato incorrecto (muestra)`);

  // 3. Ver algunos ejemplos de timestamps problemáticos
  if (invalidTimestamps.length > 0) {
    console.log("\n📋 Ejemplos de timestamps problemáticos:");
    invalidTimestamps.slice(0, 10).forEach((t) => {
      console.log(`   ID ${t.id}: "${t.timestamp}"`);
    });
  }

  // 4. Contar registros con timestamp NULL o vacío
  const nullCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM TickData
    WHERE timestamp IS NULL OR timestamp = '' OR timestamp = 'null'
  `;
  console.log(`\n📊 Registros con timestamp NULL/vacío: ${nullCount[0].count}`);

  // 5. Eliminar registros corruptos
  console.log("\n🧹 Eliminando registros corruptos...");

  // Eliminar NULL/vacíos
  const deleted1 = await prisma.$executeRawUnsafe(`
    DELETE FROM TickData
    WHERE timestamp IS NULL OR timestamp = '' OR timestamp = 'null'
  `);
  console.log(`   Eliminados NULL/vacíos: ${deleted1}`);

  // Eliminar timestamps que no empiezan con año válido (2024-2026)
  const deleted2 = await prisma.$executeRawUnsafe(`
    DELETE FROM TickData
    WHERE timestamp NOT LIKE '2024-%'
      AND timestamp NOT LIKE '2025-%'
      AND timestamp NOT LIKE '2026-%'
  `);
  console.log(`   Eliminados con año inválido: ${deleted2}`);

  // 6. Contar después
  const afterCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM TickData
  `;
  console.log(`\n📊 Ticks después: ${afterCount[0].count}`);
  console.log(`📉 Eliminados total: ${Number(beforeCount[0].count) - Number(afterCount[0].count)}`);

  // 7. VACUUM para recuperar espacio
  console.log("\n🔧 Ejecutando VACUUM...");
  await prisma.$executeRawUnsafe(`VACUUM`);
  console.log("   ✅ VACUUM completado");

  // 8. Verificar que ahora se pueden leer
  console.log("\n✅ Verificando lectura con Prisma...");
  try {
    const testRead = await prisma.tickData.findMany({
      where: { symbol: "XAUUSD" },
      orderBy: { timestamp: "asc" },
      take: 5,
    });
    console.log(`   Leídos ${testRead.length} ticks correctamente`);
    testRead.forEach((t) => console.log(`   ${t.timestamp.toISOString()} | bid: ${t.bid}`));
  } catch (e) {
    console.log("   ⚠️ Aún hay problemas de lectura:", e);
  }

  console.log("\n" + "=".repeat(50));
  console.log("LIMPIEZA COMPLETADA");
  console.log("=".repeat(50));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
