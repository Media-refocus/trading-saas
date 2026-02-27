/**
 * Script para crear usuario de prueba y API key
 *
 * Ejecutar: npx ts-node scripts/create-test-user.ts
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Creando usuario de prueba ===\n");

  // 1. Crear tenant
  const tenant = await prisma.tenant.upsert({
    where: { email: "test@test.com" },
    update: {},
    create: {
      name: "Test User",
      email: "test@test.com",
      plan: "PRO",
    },
  });
  console.log("✓ Tenant creado:", tenant.id);

  // 2. Crear usuario
  const hashedPassword = await hash("test123", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@test.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "test@test.com",
      name: "Test User",
      password: hashedPassword,
    },
  });
  console.log("✓ Usuario creado:", user.id);

  // 3. Crear suscripción (si no existe)
  const existingSubscription = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });

  let subscription;
  if (existingSubscription) {
    subscription = await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: { status: "ACTIVE", plan: "PRO" },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
      },
    });
  }
  console.log("✓ Suscripción creada:", subscription.id);

  // 4. Generar API key
  const apiKey = `tb_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = await hash(apiKey, 10);

  // 5. Crear o actualizar BotConfig
  const botConfig = await prisma.botConfig.upsert({
    where: { tenantId: tenant.id },
    update: { apiKeyHash },
    create: {
      tenantId: tenant.id,
      apiKeyHash,
      status: "OFFLINE",
      symbol: "XAUUSD",
      magicNumber: 20250101,
      entryLot: 0.1,
      entryNumOrders: 1,
      gridStepPips: 10,
      gridLot: 0.1,
      gridMaxLevels: 4,
      gridNumOrders: 1,
      gridTolerancePips: 1,
      dailyLossLimitPercent: 3.0,
    },
  });
  console.log("✓ BotConfig creado:", botConfig.id);

  console.log("\n========================================");
  console.log("🎉 Usuario de prueba creado!");
  console.log("========================================");
  console.log("\nCredenciales de login:");
  console.log("  Email: test@test.com");
  console.log("  Password: test123");
  console.log("\nAPI Key para el bot:");
  console.log(`  ${apiKey}`);
  console.log("\n⚠️  Guarda la API Key, no se mostrará de nuevo.");
  console.log("========================================\n");

  // Guardar API key en archivo
  const fs = await import("fs");
  const path = await import("path");
  const apiKeyFile = path.join(__dirname, ".test-api-key");
  fs.writeFileSync(apiKeyFile, apiKey);
  console.log(`API Key guardada en: ${apiKeyFile}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
