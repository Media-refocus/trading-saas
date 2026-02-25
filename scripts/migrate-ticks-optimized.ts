/**
 * MIGRACIÓN DE TICKS: Archivos .gz → SQLite (VERSION SUPER OPTIMIZADA)
 *
 * Usa SQL raw para máximo rendimiento y menor uso de memoria.
 * Solo importa ticks del período de las señales disponibles.
 *
 * Uso:
 *   node --max-old-space-size=8192 node_modules/.bin/tsx scripts/migrate-ticks-optimized.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const prisma = new PrismaClient();

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const BATCH_SIZE = 10000; // Lotes más grandes con SQL raw

// Período de las señales (ajustar según datos disponibles)
const MIN_DATE = new Date("2025-10-01");
const MAX_DATE = new Date("2026-02-28");

interface TickRow {
  symbol: string;
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Escape SQL para prevenir inyección
function escapeSql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "number") return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return String(value);
}

// Insertar lote usando SQL raw (mucho más rápido que Prisma createMany)
async function insertBatchRaw(batch: TickRow[]): Promise<number> {
  if (batch.length === 0) return 0;

  const values = batch.map(t =>
    `('XAUUSD', ${escapeSql(t.timestamp)}, ${t.bid}, ${t.ask}, ${t.spread})`
  ).join(",");

  try {
    // SQLite usa INSERT OR IGNORE en lugar de ON CONFLICT DO NOTHING
    await prisma.$executeRawUnsafe(`
      INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
      VALUES ${values}
    `);
    return batch.length;
  } catch (error) {
    // Si falla el batch, intentar uno por uno
    console.log("⚠️ Error en batch, insertando uno por uno:", error);
    let inserted = 0;
    for (const tick of batch) {
      try {
        await prisma.$executeRawUnsafe(`
          INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
          VALUES ('XAUUSD', ${escapeSql(tick.timestamp)}, ${tick.bid}, ${tick.ask}, ${tick.spread})
        `);
        inserted++;
      } catch {
        // Ignorar errores individuales
      }
    }
    return inserted;
  }
}

// Verificar si una fecha está en el rango
function isInDateRange(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return date >= MIN_DATE && date <= MAX_DATE;
  } catch {
    return false;
  }
}

// Extraer fecha del nombre del archivo
function getFileYearMonth(filename: string): { year: number; month: number } | null {
  const match = filename.match(/(\d{4})_(\d{2})|(\d{4})/);
  if (match) {
    if (match[1] && match[2]) {
      return { year: parseInt(match[1]), month: parseInt(match[2]) };
    }
    if (match[3]) {
      return { year: parseInt(match[3]), month: 1 };
    }
  }
  return null;
}

// Verificar si el archivo puede contener datos del período
function fileMightContainPeriod(filename: string): boolean {
  const ym = getFileYearMonth(filename);
  if (!ym) return true; // Si no podemos determinar, procesar

  const fileStart = new Date(ym.year, ym.month - 1, 1);
  const fileEnd = new Date(ym.year, ym.month, 0);

  return fileStart <= MAX_DATE && fileEnd >= MIN_DATE;
}

async function processGzFile(filePath: string): Promise<{ processed: number; inserted: number }> {
  return new Promise((resolve, reject) => {
    const batch: TickRow[] = [];
    let processed = 0;
    let inserted = 0;
    let buffer = "";
    let skipped = 0;
    let paused = false;

    console.log(`  [Procesando] ${path.basename(filePath)}...`);

    const fileStream = createReadStream(filePath, { highWaterMark: 1024 * 1024 }); // 1MB chunks
    const gunzip = createGunzip();

    const processBuffer = async () => {
      if (paused) return;

      while (batch.length >= BATCH_SIZE) {
        paused = true;
        fileStream.pause();

        const toInsert = batch.splice(0, BATCH_SIZE);
        inserted += await insertBatchRaw(toInsert);

        paused = false;
        fileStream.resume();
      }

      if (processed % 500000 === 0 && processed > 0) {
        console.log(`    📊 ${processed.toLocaleString()} procesados, ${inserted.toLocaleString()} insertados, ${skipped.toLocaleString()} fuera de rango...`);
      }
    };

    fileStream
      .pipe(gunzip)
      .on("data", async (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("timestamp")) continue;

          const parts = trimmed.split(",");
          if (parts.length < 4) continue;

          // Verificar rango de fecha ANTES de parsear completamente
          const dateStr = parts[0];
          if (!isInDateRange(dateStr)) {
            skipped++;
            continue;
          }

          try {
            const timestamp = new Date(dateStr);
            const bid = parseFloat(parts[1]);
            const ask = parseFloat(parts[2]);
            const spread = parseFloat(parts[3]);

            if (!isNaN(bid) && !isNaN(ask) && !isNaN(timestamp.getTime())) {
              batch.push({ symbol: "XAUUSD", timestamp, bid, ask, spread });
              processed++;
            }
          } catch {
            // Ignorar líneas con errores
          }
        }

        await processBuffer();
      })
      .on("end", async () => {
        // Procesar buffer final
        if (buffer) {
          const parts = buffer.split(",");
          if (parts.length >= 4 && isInDateRange(parts[0])) {
            try {
              const timestamp = new Date(parts[0]);
              const bid = parseFloat(parts[1]);
              const ask = parseFloat(parts[2]);
              const spread = parseFloat(parts[3]);

              if (!isNaN(bid) && !isNaN(ask) && !isNaN(timestamp.getTime())) {
                batch.push({ symbol: "XAUUSD", timestamp, bid, ask, spread });
                processed++;
              }
            } catch {
              // Ignorar
            }
          }
        }

        // Insertar lote final
        if (batch.length > 0) {
          inserted += await insertBatchRaw(batch);
        }

        console.log(`    ✅ Completado: ${processed.toLocaleString()} en rango, ${inserted.toLocaleString()} insertados, ${skipped.toLocaleString()} fuera de rango`);
        resolve({ processed, inserted });
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("MIGRACIÓN DE TICKS OPTIMIZADA");
  console.log(`Período: ${MIN_DATE.toISOString().slice(0, 10)} - ${MAX_DATE.toISOString().slice(0, 10)}`);
  console.log("=".repeat(60));

  // Verificar directorio
  if (!fs.existsSync(TICKS_DIR)) {
    console.error(`❌ Directorio no encontrado: ${TICKS_DIR}`);
    process.exit(1);
  }

  // Listar archivos .gz
  const allFiles = fs.readdirSync(TICKS_DIR)
    .filter(f => f.endsWith(".csv.gz"))
    .sort();

  // Filtrar archivos que pueden contener datos del período
  const files = allFiles.filter(fileMightContainPeriod);

  console.log(`\n📁 Encontrados ${allFiles.length} archivos, ${files.length} en el período:`);
  files.forEach(f => console.log(`   - ${f}`));

  // Verificar cuántos ticks hay ya en la BD
  const existingCount = await prisma.tickData.count();
  console.log(`\n📊 Ticks existentes en BD: ${existingCount.toLocaleString()}`);

  // Crear índice si no existe
  console.log("\n🔧 Verificando índices...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_tick_data_timestamp ON TickData(timestamp)
    `);
    console.log("   ✅ Índice creado/verificado");
  } catch {
    console.log("   ⚠️ Índice ya existe o error");
  }

  // Procesar cada archivo
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalInserted = 0;

  for (const file of files) {
    console.log(`\n📄 [${files.indexOf(file) + 1}/${files.length}] ${file}`);

    const filePath = path.join(TICKS_DIR, file);

    try {
      const result = await processGzFile(filePath);
      totalProcessed += result.processed;
      totalInserted += result.inserted;
    } catch (error) {
      console.error(`    ❌ Error procesando ${file}:`, error);
    }

    // Forzar GC entre archivos
    if (global.gc) {
      global.gc();
    }
  }

  // Estadísticas finales
  const elapsed = Date.now() - startTime;
  const finalCount = await prisma.tickData.count();

  console.log("\n" + "=".repeat(60));
  console.log("MIGRACIÓN COMPLETADA");
  console.log("=".repeat(60));
  console.log(`⏱️  Tiempo total: ${Math.round(elapsed / 1000)}s`);
  console.log(`📝 Ticks procesados: ${totalProcessed.toLocaleString()}`);
  console.log(`💾 Ticks insertados: ${totalInserted.toLocaleString()}`);
  console.log(`📊 Total en BD: ${finalCount.toLocaleString()}`);

  // Tamaño de la BD
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const mb = stats.size / 1024 / 1024;
    console.log(`💿 Tamaño BD: ${mb.toFixed(2)} MB`);
  }

  console.log("=".repeat(60));
}

// Ejecutar
main()
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
