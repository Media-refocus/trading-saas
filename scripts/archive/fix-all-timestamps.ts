/**
 * ELIMINAR TODOS LOS TIMESTAMPS CON FORMATO INCORRECTO
 */

import Database from "better-sqlite3";
import * as path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const db = new Database(dbPath);

db.pragma("journal_mode = OFF");
db.pragma("synchronous = OFF");

console.log("=".repeat(50));
console.log("ELIMINAR TIMESTAMPS CON FORMATO INCORRECTO");
console.log("=".repeat(50));

// ISO 8601 con ms: "2024-08-01T00:00:00.296Z" = 24 caracteres
// Pero algunos tienen: "2024-08-01T00:00:00" = 19 caracteres
// Y otros: "2026-02-13T22:59:58.837" = 23 caracteres (sin Z)

// 1. Contar por longitud
console.log("\n📊 Distribución por longitud de timestamp:");

const lengthDist = db.prepare(`
  SELECT length(timestamp) as len, COUNT(*) as count
  FROM TickData
  GROUP BY length(timestamp)
  ORDER BY len
`).all() as { len: number; count: number }[];

lengthDist.forEach((r) => {
  console.log(`   ${r.len} chars: ${r.count.toLocaleString()}`);
});

// 2. Ver qué formatos hay
console.log("\n📋 Muestras por longitud:");

for (const row of lengthDist) {
  const sample = db.prepare(`
    SELECT timestamp FROM TickData WHERE length(timestamp) = ? LIMIT 2
  `).get(row.len) as { timestamp: string };
  console.log(`   ${row.len}: "${sample.timestamp}"`);
}

// 3. Decidir qué eliminar
// Formato correcto: 24 chars (con ms y Z) o 27 (con más precisión)
// Aceptable: 19-30 chars que empiece con año válido

// Eliminar timestamps con:
// - Longitud < 19 (incompletos)
// - Longitud > 35 (con basura)
// - No empiezan con 2024, 2025, 2026

console.log("\n🧹 Eliminando timestamps inválidos...");

// Eliminar cortos
const deleted1 = db.prepare(`
  DELETE FROM TickData WHERE length(timestamp) < 19
`).run();
console.log(`   Eliminados cortos (< 19): ${deleted1.changes}`);

// Eliminar largos
const deleted2 = db.prepare(`
  DELETE FROM TickData WHERE length(timestamp) > 35
`).run();
console.log(`   Eliminados largos (> 35): ${deleted2.changes}`);

// Eliminar sin año válido
const deleted3 = db.prepare(`
  DELETE FROM TickData
  WHERE substr(timestamp, 1, 4) NOT IN ('2024', '2025', '2026')
`).run();
console.log(`   Eliminados sin año válido: ${deleted3.changes}`);

// Eliminar sin T
const deleted4 = db.prepare(`
  DELETE FROM TickData WHERE timestamp NOT LIKE '%T%'
`).run();
console.log(`   Eliminados sin T: ${deleted4.changes}`);

// Contar total
const total = db.prepare("SELECT COUNT(*) as count FROM TickData").get() as { count: number };
console.log(`\n📊 Total ticks restantes: ${total.count.toLocaleString()}`);

// Ver rangos
const first = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp ASC LIMIT 1").get() as { timestamp: string };
const last = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp DESC LIMIT 1").get() as { timestamp: string };
console.log(`\n📅 Rango:`);
console.log(`   Primero: ${first?.timestamp}`);
console.log(`   Último: ${last?.timestamp}`);

// VACUUM
console.log("\n🔧 VACUUM...");
db.exec("VACUUM");
console.log("   ✅ Done");

db.close();

console.log("\n" + "=".repeat(50));
console.log("COMPLETADO");
