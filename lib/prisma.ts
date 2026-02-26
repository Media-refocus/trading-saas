import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Crear cliente Prisma con URL dinámica si DATABASE_URL está definido
// Esto permite que los tests usen una base de datos separada
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
