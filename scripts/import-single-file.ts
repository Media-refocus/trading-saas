/**
 * IMPORTAR ARCHIVO INDIVIDUAL DE TICKS
 *
 * Uso: npx tsx scripts/import-single-file.ts <archivo.gz>
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

const TICKS_DIR = path.join(process.cwd(), "data", "ticks");

// Rango completo de señales
const MIN_DATE = new Date("2024-08-01");
const MAX_DATE = new Date("2026-02-28T23:59:59");

async function importFile(filename: string): Promise<number> {
  const filePath = path.join(TICKS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ Archivo no encontrado: ${filename}`);
    return 0;
  }

  console.log(`📄 Importando ${filename}...`);

  return new Promise((resolve, reject) => {
    const batch: string[] = [];
    let inserted = 0;
    let buffer = "";
    let lineCount = 0;

    const fileStream = createReadStream(filePath, { highWaterMark: 128 * 1024 });
    const gunzip = createGunzip();

    const flushBatch = async () => {
      if (batch.length === 0) return;

      const values = batch.join(",");
      batch.length = 0;

      try {
        await prisma.$executeRawUnsafe(`
          INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
          VALUES ${values}
        `);
        inserted += BATCH_SIZE;
      } catch {
        // Ignorar errores de batch
      }
    };

    gunzip.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("timestamp")) continue;

        lineCount++;

        const parts = trimmed.split(",");
        if (parts.length < 4) continue;

        // Verificar fecha
        const dateStr = parts[0];
        try {
          const date = new Date(dateStr);
          if (date < MIN_DATE || date > MAX_DATE) continue;
        } catch {
          continue;
        }

        const bid = parseFloat(parts[1]);
        const ask = parseFloat(parts[2]);
        const spread = parseFloat(parts[3]);

        if (isNaN(bid) || isNaN(ask)) continue;

        batch.push(`('XAUUSD', '${dateStr}', ${bid}, ${ask}, ${spread})`);

        if (batch.length >= BATCH_SIZE) {
          flushBatch();
        }
      }

      if (lineCount % 1000000 === 0) {
        console.log(`  ${Math.round(lineCount / 1000000)}M líneas...`);
      }
    });

    gunzip.on("end", async () => {
      // Flush final
      if (batch.length > 0) {
        const values = batch.join(",");
        try {
          await prisma.$executeRawUnsafe(`
            INSERT OR IGNORE INTO TickData (symbol, timestamp, bid, ask, spread)
            VALUES ${values}
          `);
          inserted += batch.length;
        } catch {}
      }

      console.log(`  ✅ ${inserted.toLocaleString()} ticks insertados`);
      resolve(inserted);
    });

    gunzip.on("error", reject);
    fileStream.pipe(gunzip);
  });
}

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    console.log("Uso: npx tsx scripts/import-single-file.ts <archivo.gz>");
    console.log("\nArchivos disponibles:");
    const files = fs.readdirSync(TICKS_DIR).filter(f => f.endsWith(".gz"));
    files.forEach(f => console.log(`  ${f}`));
    process.exit(1);
  }

  const before = await prisma.tickData.count();
  console.log(`📊 Ticks antes: ${before.toLocaleString()}`);

  await importFile(filename);

  const after = await prisma.tickData.count();
  console.log(`📊 Ticks después: ${after.toLocaleString()}`);
  console.log(`📈 Incremento: ${(after - before).toLocaleString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
