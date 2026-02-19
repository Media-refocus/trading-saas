/**
 * MIGRACIÓN DE TICKS: Archivos .gz → SQLite (VERSION OPTIMIZADA)
 *
 * Esta versión inserta ticks en lotes pequeños mientras procesa
 * para evitar quedarse sin memoria con archivos grandes.
 *
 * Uso:
 *   npx tsx scripts/migrate-ticks-to-sqlite.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const BATCH_SIZE = 5000; // Insertar cada 5000 ticks

interface TickRow {
  symbol: string;
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

/**
 * Parsea una línea del CSV de ticks
 */
function parseTickLine(line: string, symbol: string = "XAUUSD"): TickRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("timestamp")) {
    return null;
  }

  const parts = trimmed.split(",");
  if (parts.length < 4) {
    return null;
  }

  try {
    const timestamp = new Date(parts[0]);
    const bid = parseFloat(parts[1]);
    const ask = parseFloat(parts[2]);
    const spread = parseFloat(parts[3]);

    if (isNaN(bid) || isNaN(ask) || isNaN(timestamp.getTime())) {
      return null;
    }

    return { symbol, timestamp, bid, ask, spread };
  } catch {
    return null;
  }
}

/**
 * Procesa un archivo .gz e inserta ticks en lotes
 */
async function processGzFile(filePath: string, symbol: string = "XAUUSD"): Promise<{ processed: number; inserted: number }> {
  return new Promise((resolve, reject) => {
    const batch: TickRow[] = [];
    let processed = 0;
    let inserted = 0;
    let buffer = "";

    console.log(`  [Procesando] ${path.basename(filePath)}...`);

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    const insertBatch = async () => {
      if (batch.length === 0) return;

      const ticksToInsert = [...batch];
      batch.length = 0;

      try {
        await prisma.tickData.createMany({
          data: ticksToInsert,
        });
        inserted += ticksToInsert.length;
      } catch (error) {
        // Si falla el lote completo, intentar uno por uno
        for (const tick of ticksToInsert) {
          try {
            await prisma.tickData.create({ data: tick });
            inserted++;
          } catch {
            // Ignorar duplicados
          }
        }
      }
    };

    fileStream
      .pipe(gunzip)
      .on("data", async (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const tick = parseTickLine(line, symbol);
          if (tick) {
            batch.push(tick);
            processed++;

            // Insertar cuando el lote está lleno
            if (batch.length >= BATCH_SIZE) {
              // Pausar el stream mientras insertamos
              fileStream.pause();
              await insertBatch();
              fileStream.resume();

              if (processed % 100000 === 0) {
                console.log(`    📊 ${processed.toLocaleString()} procesados, ${inserted.toLocaleString()} insertados...`);
              }
            }
          }
        }
      })
      .on("end", async () => {
        // Procesar última línea y lote final
        if (buffer) {
          const tick = parseTickLine(buffer, symbol);
          if (tick) {
            batch.push(tick);
            processed++;
          }
        }

        await insertBatch();

        console.log(`    ✅ Completado: ${processed.toLocaleString()} procesados, ${inserted.toLocaleString()} insertados`);
        resolve({ processed, inserted });
      })
      .on("error", reject);
  });
}

/**
 * Función principal
 */
async function main() {
  console.log("=".repeat(60));
  console.log("MIGRACIÓN DE TICKS: .gz → SQLite (Optimizado)");
  console.log("=".repeat(60));

  // Verificar directorio
  if (!fs.existsSync(TICKS_DIR)) {
    console.error(`❌ Directorio no encontrado: ${TICKS_DIR}`);
    process.exit(1);
  }

  // Listar archivos .gz
  const files = fs.readdirSync(TICKS_DIR)
    .filter(f => f.endsWith(".csv.gz"))
    .sort();

  if (files.length === 0) {
    console.error("❌ No hay archivos .csv.gz en el directorio");
    process.exit(1);
  }

  console.log(`\n📁 Encontrados ${files.length} archivos:`);
  files.forEach(f => console.log(`   - ${f}`));

  // Verificar cuántos ticks hay ya en la BD
  const existingCount = await prisma.tickData.count();
  console.log(`\n📊 Ticks existentes en BD: ${existingCount.toLocaleString()}`);

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
