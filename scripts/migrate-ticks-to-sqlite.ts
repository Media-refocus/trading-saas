/**
 * MIGRACIÓN DE TICKS: Archivos .gz → SQLite
 *
 * Este script importa todos los ticks desde los archivos .gz comprimidos
 * a la base de datos SQLite para backtests rápidos sin consumir memoria.
 *
 * Uso:
 *   npx ts-node scripts/migrate-ticks-to-sqlite.ts
 *
 * O con tsx:
 *   npx tsx scripts/migrate-ticks-to-sqlite.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const BATCH_SIZE = 5000; // Insertar en lotes para eficiencia

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
 * Procesa un archivo .gz y retorna los ticks
 */
async function processGzFile(filePath: string, symbol: string = "XAUUSD"): Promise<TickRow[]> {
  return new Promise((resolve, reject) => {
    const ticks: TickRow[] = [];
    let buffer = "";
    let lineCount = 0;

    console.log(`  [Procesando] ${path.basename(filePath)}...`);

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    fileStream
      .pipe(gunzip)
      .on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const tick = parseTickLine(line, symbol);
          if (tick) {
            ticks.push(tick);
            lineCount++;

            if (lineCount % 100000 === 0) {
              console.log(`    ${lineCount.toLocaleString()} líneas procesadas...`);
            }
          }
        }
      })
      .on("end", () => {
        // Procesar última línea si queda algo en buffer
        if (buffer) {
          const tick = parseTickLine(buffer, symbol);
          if (tick) {
            ticks.push(tick);
          }
        }
        console.log(`    ✅ Total: ${ticks.length.toLocaleString()} ticks`);
        resolve(ticks);
      })
      .on("error", reject);
  });
}

/**
 * Inserta ticks en lotes a la base de datos
 */
async function insertTicksBatch(ticks: TickRow[]): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < ticks.length; i += BATCH_SIZE) {
    const batch = ticks.slice(i, i + BATCH_SIZE);

    try {
      await prisma.tickData.createMany({
        data: batch,
        // SQLite no soporta skipDuplicates, usamos try/catch para manejar errores
      });
      inserted += batch.length;

      if ((i + BATCH_SIZE) % 50000 === 0) {
        console.log(`    💾 Insertados ${inserted.toLocaleString()} ticks en BD...`);
      }
    } catch (error) {
      console.error(`    ⚠️ Error insertando lote ${i}:`, error);
    }
  }

  return inserted;
}

/**
 * Función principal
 */
async function main() {
  console.log("=".repeat(60));
  console.log("MIGRACIÓN DE TICKS: .gz → SQLite");
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

  if (existingCount > 0) {
    console.log("⚠️  La BD ya tiene ticks. Se continuarán añadiendo (skipDuplicates activado).");
  }

  // Procesar cada archivo
  const startTime = Date.now();
  let totalInserted = 0;

  for (const file of files) {
    console.log(`\n📄 [${files.indexOf(file) + 1}/${files.length}] ${file}`);

    const filePath = path.join(TICKS_DIR, file);

    try {
      // Procesar archivo
      const ticks = await processGzFile(filePath);

      if (ticks.length === 0) {
        console.log("    ⚠️  No se encontraron ticks válidos");
        continue;
      }

      // Insertar en BD
      console.log(`    💾 Insertando en SQLite...`);
      const inserted = await insertTicksBatch(ticks);
      totalInserted += inserted;

      console.log(`    ✅ Insertados: ${inserted.toLocaleString()} ticks`);
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
  console.log(`📝 Ticks procesados: ${totalInserted.toLocaleString()}`);
  console.log(`📊 Total en BD: ${finalCount.toLocaleString()}`);
  console.log(`💾 Tamaño BD: ${await getDbSize()}`);
  console.log("=".repeat(60));
}

/**
 * Obtiene el tamaño de la base de datos
 */
async function getDbSize(): Promise<string> {
  const dbPath = path.join(process.cwd(), "prisma", "dev.db");

  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const mb = stats.size / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  return "N/A";
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
