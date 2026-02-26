/**
 * FIX DIRECTO CON BETTER-SQLITE3
 *
 * Usa better-sqlite3 para acceder directamente a SQLite
 * sin pasar por Prisma (que falla con timestamps corruptos)
 */

import Database from "better-sqlite3";
import * as path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const db = new Database(dbPath);

// Configurar para mejor rendimiento
db.pragma("journal_mode = OFF");
db.pragma("synchronous = OFF");

console.log("=".repeat(50));
console.log("FIX DIRECTO CON BETTER-SQLITE3");
console.log("=".repeat(50));

// 1. Contar total
const countBefore = db.prepare("SELECT COUNT(*) as count FROM TickData").get() as { count: number };
console.log(`\n📊 Total ticks: ${countBefore.count.toLocaleString()}`);

// 2. Encontrar timestamps inválidos
console.log("\n🔍 Buscando timestamps con longitud incorrecta...");

// Timestamps muy cortos o muy largos
const invalidLength = db.prepare(`
  SELECT id, timestamp FROM TickData
  WHERE length(timestamp) < 20 OR length(timestamp) > 35
  LIMIT 100
`).all() as { id: number; timestamp: string }[];

console.log(`   Encontrados ${invalidLength.length} con longitud incorrecta`);

if (invalidLength.length > 0) {
  console.log("\n📋 Ejemplos:");
  invalidLength.slice(0, 10).forEach((t) => {
    console.log(`   ID ${t.id}: "${t.timestamp}" (len: ${t.timestamp.length})`);
  });
}

// 3. Buscar timestamps que no empiezan con año válido
console.log("\n🔍 Buscando timestamps sin año válido...");

const invalidYear = db.prepare(`
  SELECT id, timestamp FROM TickData
  WHERE substr(timestamp, 1, 4) NOT IN ('2024', '2025', '2026')
  LIMIT 100
`).all() as { id: number; timestamp: string }[];

console.log(`   Encontrados ${invalidYear.length} sin año válido`);

if (invalidYear.length > 0) {
  console.log("\n📋 Ejemplos:");
  invalidYear.slice(0, 10).forEach((t) => {
    console.log(`   ID ${t.id}: "${t.timestamp}"`);
  });
}

// 4. Buscar timestamps con caracteres no ASCII
console.log("\n🔍 Buscando caracteres no imprimibles...");

const nonAscii = db.prepare(`
  SELECT id, timestamp FROM TickData
  WHERE timestamp != CAST(timestamp AS BLOB)
  LIMIT 100
`).all() as { id: number; timestamp: string }[];

console.log(`   Encontrados ${nonAscii.length} con caracteres extraños`);

// 5. Recopilar todos los IDs a eliminar
const idsToDelete = new Set<number>();

invalidLength.forEach((t) => idsToDelete.add(t.id));
invalidYear.forEach((t) => idsToDelete.add(t.id));
nonAscii.forEach((t) => idsToDelete.add(t.id));

console.log(`\n📊 Total IDs a eliminar: ${idsToDelete.size}`);

// 6. Eliminar
if (idsToDelete.size > 0) {
  console.log("\n🧹 Eliminando registros corruptos...");

  const deleteStmt = db.prepare("DELETE FROM TickData WHERE id = ?");
  const deleteMany = db.transaction((ids: number[]) => {
    for (const id of ids) {
      deleteStmt.run(id);
    }
  });

  deleteMany(Array.from(idsToDelete));
  console.log(`   Eliminados: ${idsToDelete.size}`);
}

// 7. Contar después
const countAfter = db.prepare("SELECT COUNT(*) as count FROM TickData").get() as { count: number };
console.log(`\n📊 Ticks después: ${countAfter.count.toLocaleString()}`);
console.log(`📉 Eliminados total: ${countBefore.count - countAfter.count}`);

// 8. Verificar rangos de timestamps
console.log("\n📅 Verificando rangos...");

const firstTs = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp ASC LIMIT 1").get() as { timestamp: string };
const lastTs = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp DESC LIMIT 1").get() as { timestamp: string };

console.log(`   Primero: ${firstTs?.timestamp}`);
console.log(`   Último: ${lastTs?.timestamp}`);

// 9. VACUUM
console.log("\n🔧 VACUUM...");
db.exec("VACUUM");
console.log("   ✅ Done");

// 10. Cerrar
db.close();

console.log("\n" + "=".repeat(50));
console.log("COMPLETADO");
console.log("=".repeat(50));
