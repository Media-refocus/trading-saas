/**
 * Global setup para Vitest - se ejecuta ANTES de cargar cualquier test
 *
 * IMPORTANTE: Establece DATABASE_URL antes de que cualquier módulo importe Prisma
 */

import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

const TEST_DB_PATH = join(process.cwd(), "prisma", "test.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

export default function setup() {
  console.log("\n🔧 Global setup: Configurando test database...");

  // Establecer DATABASE_URL ANTES de cualquier import
  process.env.DATABASE_URL = TEST_DB_URL;

  // Eliminar DB anterior si existe
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
      console.log("  Removed old test database");
    } catch {
      // Ignorar
    }
  }

  // Eliminar journal si existe
  const journalPath = TEST_DB_PATH + "-journal";
  if (existsSync(journalPath)) {
    try {
      unlinkSync(journalPath);
    } catch {
      // Ignorar
    }
  }

  // Crear schema con db push
  try {
    execSync("npx prisma db push --skip-generate", {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "pipe",
      cwd: process.cwd(),
    });
    console.log("  ✅ Test database schema created\n");
  } catch (error) {
    console.error("  ❌ Error creating test database:", error);
    throw error;
  }
}
