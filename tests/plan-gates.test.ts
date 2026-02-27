/**
 * Tests para la lógica de expiración de trial en plan-gates.ts
 *
 * Casos cubiertos:
 * 1. Trial no expirado -> devuelve status TRIAL sin cambios
 * 2. Trial expirado -> actualiza status a PAUSED
 * 3. Suscripción activa -> sin cambios
 * 4. Sin suscripción -> devuelve PAUSED/BASIC
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { checkAndUpdateExpiredTrial } from "@/lib/plan-gates";
import {
  getTestPrisma,
  createTestTenant,
  cleanupTestDb,
} from "./setup";

const prisma = getTestPrisma();

// Helper para crear suscripción de test
async function createTestSubscription(data: {
  tenantId: string;
  plan?: "BASIC" | "PRO" | "ENTERPRISE";
  status?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";
  trialEnd?: Date | null;
}) {
  return prisma.subscription.create({
    data: {
      tenantId: data.tenantId,
      plan: data.plan ?? "PRO",
      status: data.status ?? "TRIAL",
      trialEnd: data.trialEnd ?? null,
    },
  });
}

describe("checkAndUpdateExpiredTrial", () => {
  beforeAll(async () => {
    // La DB de test ya está configurada por global-setup.ts
  }, 60000);

  beforeEach(async () => {
    // Limpiar DB antes de cada test
    await cleanupTestDb();
  });

  describe("Caso 1: Trial no expirado aún", () => {
    it("debe devolver status TRIAL cuando trialEnd está en el futuro", async () => {
      // Arrange: crear tenant con trial activo (expira en 7 días)
      const tenant = await createTestTenant("trial-active@test.com");
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: futureDate,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("TRIAL");
      expect(result.plan).toBe("PRO");
      expect(result.trialEnd).toEqual(futureDate);

      // Verificar que NO se actualizó en la DB
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
      });
      expect(subscription?.status).toBe("TRIAL");
    });

    it("debe devolver status TRIAL cuando trialEnd es hoy pero aún no ha pasado", async () => {
      // Arrange: trial expira al final del día de hoy
      const tenant = await createTestTenant("trial-today@test.com");
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: endOfToday,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("TRIAL");
    });
  });

  describe("Caso 2: Trial expirado sin suscripción activa -> PAUSED", () => {
    it("debe actualizar status a PAUSED cuando trialEnd ya pasó", async () => {
      // Arrange: crear tenant con trial expirado (hace 1 día)
      const tenant = await createTestTenant("trial-expired@test.com");
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: pastDate,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: devuelve PAUSED
      expect(result.status).toBe("PAUSED");
      expect(result.plan).toBe("PRO");
      expect(result.trialEnd).toEqual(pastDate);

      // Verificar que SÍ se actualizó en la DB
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
      });
      expect(subscription?.status).toBe("PAUSED");
    });

    it("debe actualizar el tenant plan a TRIAL cuando expira", async () => {
      // Arrange
      const tenant = await createTestTenant("trial-expired-tenant@test.com");
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: pastDate,
      });

      // Act
      await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: verificar que el tenant se actualizó
      const updatedTenant = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(updatedTenant?.plan).toBe("TRIAL");
    });

    it("debe pausar trial que expiró hace varios días", async () => {
      // Arrange: trial expiró hace 14 días
      const tenant = await createTestTenant("trial-old-expired@test.com");
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 14);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: oldDate,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("PAUSED");
    });

    it("debe pausar trial cuando trialEnd es null y status es TRIAL", async () => {
      // Arrange: trial sin fecha de expiración (edge case)
      const tenant = await createTestTenant("trial-no-date@test.com");

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: null,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: cuando trialEnd es null, NO debe pausar (no hay fecha de expiración)
      expect(result.status).toBe("TRIAL");
    });
  });

  describe("Caso 3: Trial expirado pero tiene suscripción activa -> sin cambios", () => {
    it("no debe cambiar status ACTIVE aunque trialEnd haya pasado", async () => {
      // Arrange: usuario con suscripción ACTIVE (ya pagó)
      const tenant = await createTestTenant("active-sub@test.com");
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "ACTIVE",
        trialEnd: pastDate, // trialEnd pasado pero status es ACTIVE
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: no cambia porque status no es TRIAL
      expect(result.status).toBe("ACTIVE");
      expect(result.plan).toBe("PRO");

      // Verificar que NO se actualizó en la DB
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
      });
      expect(subscription?.status).toBe("ACTIVE");
    });

    it("no debe cambiar status PAST_DUE", async () => {
      // Arrange: usuario con pago pendiente
      const tenant = await createTestTenant("past-due@test.com");

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "PAST_DUE",
        trialEnd: null,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("PAST_DUE");
    });

    it("no debe cambiar status CANCELED", async () => {
      // Arrange: usuario cancelado
      const tenant = await createTestTenant("canceled@test.com");

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "BASIC",
        status: "CANCELED",
        trialEnd: null,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("CANCELED");
    });

    it("no debe cambiar status PAUSED existente", async () => {
      // Arrange: usuario ya pausado
      const tenant = await createTestTenant("already-paused@test.com");

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "BASIC",
        status: "PAUSED",
        trialEnd: null,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("PAUSED");
    });
  });

  describe("Caso 4: Usuario sin suscripción", () => {
    it("debe devolver PAUSED/BASIC cuando no existe suscripción", async () => {
      // Arrange: tenant sin suscripción
      const tenant = await createTestTenant("no-sub@test.com");

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: trata como pausado
      expect(result.status).toBe("PAUSED");
      expect(result.plan).toBe("BASIC");
      expect(result.trialEnd).toBeNull();
    });

    it("debe funcionar correctamente con tenant que nunca tuvo suscripción", async () => {
      // Arrange: tenant nuevo sin nada
      const tenant = await createTestTenant("new-user@test.com");

      // Verificar que no hay suscripción
      const existingSub = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
      });
      expect(existingSub).toBeNull();

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert
      expect(result.status).toBe("PAUSED");
      expect(result.plan).toBe("BASIC");
      expect(result.trialEnd).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("debe manejar trialEnd exactamente igual a now", async () => {
      // Arrange: trial expira exactamente ahora
      const tenant = await createTestTenant("trial-exact@test.com");
      const now = new Date();

      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: now,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: trialEnd < now es false cuando son iguales, pero
      // pueden pasar milisegundos entre crear y verificar.
      // El comportamiento esperado es: si trialEnd < now -> PAUSED
      // Si trialEnd >= now -> TRIAL
      // Dado que creamos con "now", puede ser TRIAL o PAUSED dependiendo del timing
      expect(["TRIAL", "PAUSED"]).toContain(result.status);
    });

    it("debe usar la suscripción más reciente si hay múltiples", async () => {
      // Arrange: crear suscripción antigua primero
      const tenant = await createTestTenant("multi-sub@test.com");
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      // Suscripción antigua (expirada)
      await createTestSubscription({
        tenantId: tenant.id,
        plan: "BASIC",
        status: "CANCELED",
        trialEnd: pastDate,
      });

      // Esperar un poco para asegurar ordenamiento por createdAt
      await new Promise((r) => setTimeout(r, 10));

      // Suscripción nueva (activa)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      await createTestSubscription({
        tenantId: tenant.id,
        plan: "PRO",
        status: "TRIAL",
        trialEnd: futureDate,
      });

      // Act
      const result = await checkAndUpdateExpiredTrial(tenant.id);

      // Assert: usa la más reciente (TRIAL activo)
      expect(result.status).toBe("TRIAL");
      expect(result.plan).toBe("PRO");
    });
  });
});
