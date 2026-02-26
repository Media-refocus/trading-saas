/**
 * CONTINUAR IMPORTACIÓN - desde Feb 2025
 *
 * Procesa solo lo que falta: Feb 2025 - Feb 2026
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const BATCH_SIZE = 500; // Lotes más pequeños

// Solo lo que falta
const MIN_DATE = new Date("2025-02-01");
const MAX_DATE = new Date("2026-02-28T23:59:59");

interface TickRow {
  symbol: string;
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

async function insertBatch(batch: TickRow[]): Promise<number> {
  if (batch.length === 0) return 0;

  const values = batch.map(t =>
    `('XAUUSD', '${t.timestamp.toISOString()}', ${t.bid}, ${t.ask}, ${t.spread})`
  ).join(",");

  try {
    await prisma.$executeRawUnsafe(`
      INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
      VALUES ${values}
    `);
    return batch.length;
  } catch {
    return 0;
  }
}

function isInDateRange(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return date >= MIN_DATE && date <= MAX_DATE;
  } catch {
    return false;
  }
}

async function processFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const batch: TickRow[] = [];
    let inserted = 0;
    let buffer = "";
    let lineCount = 0;

    console.log(`  Procesando ${path.basename(filePath)}...`);

    const fileStream = createReadStream(filePath, { highWaterMark: 256 * 1024 });
    const gunzip = createGunzip();

    gunzip.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("timestamp")) continue;

        lineCount++;
        if (lineCount % 2000000 === 0) {
          console.log(`    ${Math.round(lineCount / 1000000)}M líneas leídas, ${inserted.toLocaleString()} insertados...`);
        }

        const parts = trimmed.split(",");
        if (parts.length < 4) continue;
        if (!isInDateRange(parts[0])) continue;

        try {
          const timestamp = new Date(parts[0]);
          const bid = parseFloat(parts[1]);
          const ask = parseFloat(parts[2]);
          const spread = parseFloat(parts[3]);

          if (!isNaN(bid) && !isNaN(ask) && !isNaN(timestamp.getTime())) {
            batch.push({ symbol: "XAUUSD", timestamp, bid, ask, spread });

            if (batch.length >= BATCH_SIZE) {
              const toInsert = batch.splice(0, BATCH_SIZE);
              insertBatch(toInsert).then(n => inserted += n);
            }
          }
        } catch {}
      }
    });

    gunzip.on("end", async () => {
      // Insertar restantes
      while (batch.length > 0) {
        const toInsert = batch.splice(0, BATCH_SIZE);
        inserted += await insertBatch(toInsert);
      }

      console.log(`    ✅ ${inserted.toLocaleString()} ticks insertados`);
      resolve(inserted);
    });

    gunzip.on("error", reject);
    fileStream.pipe(gunzip);
  });
}

async function main() {
  console.log("=".repeat(50));
  console.log("CONTINUAR IMPORTACIÓN");
  console.log(`Período: Feb 2025 - Feb 2026`);
  console.log("=".repeat(50));

  const existing = await prisma.tickData.count();
  console.log(`\n📊 Ticks actuales: ${existing.toLocaleString()}`);

  // Procesar 2025 y 2026
  const files = ["XAUUSD_2025.csv.gz", "XAUUSD_2026.csv.gz"];
  let totalInserted = 0;

  for (const file of files) {
    const filePath = path.join(TICKS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️ ${file} no encontrado`);
      continue;
    }

    try {
      const inserted = await processFile(filePath);
      totalInserted += inserted;

      // Forzar GC
      if (global.gc) global.gc();
    } catch (error) {
      console.error(`  ❌ Error en ${file}:`, error);
    }
  }

  const final = await prisma.tickData.count();
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Completado: ${totalInserted.toLocaleString()} nuevos`);
  console.log(`📊 Total BD: ${final.toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
