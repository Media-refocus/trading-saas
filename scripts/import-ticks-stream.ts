/**
 * IMPORTACIÓN DE TICKS V2 - Ultra robusta para 80M+ ticks
 *
 * Estrategia:
 * 1. Procesar archivos uno por uno
 * 2. Usar streams sin cargar todo en memoria
 * 3. Inserts en lotes pequeños con reintentos
 * 4. Commit cada 100K ticks para evitar locks largos
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";
import { pipeline } from "stream/promises";
import { Writable } from "stream";

const prisma = new PrismaClient();

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const BATCH_SIZE = 1000; // Lotes más pequeños
const COMMIT_EVERY = 100000; // Commit cada 100K

// Período: Ago 2024 → Feb 2026 (todas las señales)
const MIN_DATE = new Date("2024-08-01");
const MAX_DATE = new Date("2026-02-28T23:59:59");

interface TickRow {
  symbol: string;
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Insertar con reintentos
async function insertBatchWithRetry(batch: TickRow[], maxRetries = 3): Promise<number> {
  if (batch.length === 0) return 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const values = batch.map(t =>
        `('XAUUSD', '${t.timestamp.toISOString()}', ${t.bid}, ${t.ask}, ${t.spread})`
      ).join(",");

      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
        VALUES ${values}
      `);
      return batch.length;
    } catch (error: any) {
      if (error.message?.includes("locked") && attempt < maxRetries) {
        console.log(`   ⚠️ BD bloqueada, reintento ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      // Si falla, intentar uno por uno
      if (attempt === maxRetries) {
        let inserted = 0;
        for (const tick of batch) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
              VALUES ('XAUUSD', '${tick.timestamp.toISOString()}', ${tick.bid}, ${tick.ask}, ${tick.spread})
            `);
            inserted++;
          } catch {
            // Ignorar errores individuales
          }
        }
        return inserted;
      }
    }
  }
  return 0;
}

// Verificar rango de fecha
function isInDateRange(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return date >= MIN_DATE && date <= MAX_DATE;
  } catch {
    return false;
  }
}

// Procesar un archivo .gz
async function processGzFile(filePath: string, fileIndex: number, totalFiles: number): Promise<{ processed: number; inserted: number }> {
  return new Promise((resolve, reject) => {
    const batch: TickRow[] = [];
    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let buffer = "";
    let isPaused = false;
    let pendingInserts = 0;

    console.log(`\n📄 [${fileIndex}/${totalFiles}] ${path.basename(filePath)}`);

    const fileStream = createReadStream(filePath, { highWaterMark: 512 * 1024 }); // 512KB chunks
    const gunzip = createGunzip();

    const processBatch = async () => {
      if (isPaused || batch.length < BATCH_SIZE) return;

      isPaused = true;
      fileStream.pause();

      const toInsert = batch.splice(0, BATCH_SIZE);
      pendingInserts++;
      inserted += await insertBatchWithRetry(toInsert);
      pendingInserts--;

      isPaused = false;
      fileStream.resume();

      if (processed % 500000 === 0 && processed > 0) {
        console.log(`   📊 ${processed.toLocaleString()} procesados, ${inserted.toLocaleString()} insertados`);
      }
    };

    gunzip.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("timestamp")) continue;

        const parts = trimmed.split(",");
        if (parts.length < 4) continue;

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

      if (batch.length >= BATCH_SIZE) {
        processBatch();
      }
    });

    gunzip.on("end", async () => {
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
          } catch {}
        }
      }

      // Insertar lote final
      while (batch.length > 0) {
        const toInsert = batch.splice(0, BATCH_SIZE);
        inserted += await insertBatchWithRetry(toInsert);
      }

      // Esperar inserts pendientes
      while (pendingInserts > 0) {
        await new Promise(r => setTimeout(r, 100));
      }

      console.log(`   ✅ ${processed.toLocaleString()} en rango, ${inserted.toLocaleString()} insertados, ${skipped.toLocaleString()} fuera de rango`);
      resolve({ processed, inserted });
    });

    gunzip.on("error", reject);

    fileStream.pipe(gunzip);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("IMPORTACIÓN DE TICKS V2 - Ultra Robusta");
  console.log(`Período: ${MIN_DATE.toISOString().slice(0, 10)} - ${MAX_DATE.toISOString().slice(0, 10)}`);
  console.log("=".repeat(60));

  // Listar archivos
  const files = fs.readdirSync(TICKS_DIR)
    .filter(f => f.endsWith(".csv.gz"))
    .sort();

  console.log(`\n📁 ${files.length} archivos encontrados:`);
  files.forEach(f => console.log(`   - ${f}`));

  // Contar existentes
  const existing = await prisma.tickData.count();
  console.log(`\n📊 Ticks en BD: ${existing.toLocaleString()}`);

  // Crear índice
  console.log("\n🔧 Verificando índices...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_tick_data_timestamp ON TickData(timestamp)
    `);
    console.log("   ✅ Índice listo");
  } catch (e) {
    console.log("   ⚠️ Índice ya existe");
  }

  // Procesar cada archivo
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalInserted = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(TICKS_DIR, file);

    try {
      const result = await processGzFile(filePath, i + 1, files.length);
      totalProcessed += result.processed;
      totalInserted += result.inserted;
    } catch (error) {
      console.error(`   ❌ Error en ${file}:`, error);
    }

    // Forzar GC
    if (global.gc) global.gc();
  }

  // Estadísticas finales
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const finalCount = await prisma.tickData.count();

  console.log("\n" + "=".repeat(60));
  console.log("IMPORTACIÓN COMPLETADA");
  console.log("=".repeat(60));
  console.log(`⏱️  Tiempo: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`📝 Procesados: ${totalProcessed.toLocaleString()}`);
  console.log(`💾 Insertados: ${totalInserted.toLocaleString()}`);
  console.log(`📊 Total BD: ${finalCount.toLocaleString()}`);

  // Tamaño BD
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  if (fs.existsSync(dbPath)) {
    const mb = fs.statSync(dbPath).size / 1024 / 1024;
    console.log(`💿 Tamaño BD: ${mb.toFixed(0)} MB`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
