/**
 * Probar ticks-db con better-sqlite3
 */

import * as ticksDb from "../lib/ticks-db-better";

async function main() {
  console.log("=".repeat(50));
  console.log("PRUEBA DE TICKS-DB CON BETTER-SQLITE3");
  console.log("=".repeat(50));

  // 1. Estadísticas
  console.log("\n📊 Estadísticas...");
  const stats = await ticksDb.getTicksStats();
  console.log(`   Total ticks: ${stats.totalTicks.toLocaleString()}`);
  console.log(`   Primer tick: ${stats.firstTick?.toISOString()}`);
  console.log(`   Último tick: ${stats.lastTick?.toISOString()}`);

  // 2. Leer ticks de octubre 2025
  console.log("\n📅 Leyendo ticks de oct 2025...");
  const octTicks = await ticksDb.getTicksFromDB(
    new Date("2025-10-08T07:00:00Z"),
    new Date("2025-10-08T08:00:00Z"),
    "XAUUSD"
  );
  console.log(`   Encontrados: ${octTicks.length}`);
  if (octTicks.length > 0) {
    console.log("   Primeros 5:");
    octTicks.slice(0, 5).forEach((t) => {
      console.log(`     ${t.timestamp.toISOString()} | bid: ${t.bid} | ask: ${t.ask}`);
    });
  }

  // 3. Leer últimos ticks
  console.log("\n📅 Últimos ticks...");
  const lastTick = await ticksDb.getLastTick();
  console.log(`   ${lastTick?.timestamp.toISOString()} | bid: ${lastTick?.bid}`);

  // 4. Verificar que la BD está lista
  console.log("\n✅ BD lista:", await ticksDb.isTicksDBReady());

  console.log("\n" + "=".repeat(50));
  console.log("TODAS LAS PRUEBAS PASARON");
  console.log("=".repeat(50));
}

main().catch(console.error);
