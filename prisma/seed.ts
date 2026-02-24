import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding plans...");

  // Crear planes
  const plans = [
    {
      name: "Basic",
      price: 49,
      currency: "USD",
      maxPositions: 1,
      maxBrokers: 1,
      maxLevels: 2,
      hasTrailingSL: true,
      hasAdvancedGrid: false,
      hasPriority: false,
    },
    {
      name: "Pro",
      price: 99,
      currency: "USD",
      maxPositions: 3,
      maxBrokers: 3,
      maxLevels: 4,
      hasTrailingSL: true,
      hasAdvancedGrid: true,
      hasPriority: false,
    },
    {
      name: "Enterprise",
      price: 249,
      currency: "USD",
      maxPositions: 10,
      maxBrokers: 999,
      maxLevels: 10,
      hasTrailingSL: true,
      hasAdvancedGrid: true,
      hasPriority: true,
    },
  ];

  for (const planData of plans) {
    // Buscar plan existente por nombre
    const existing = await prisma.plan.findFirst({
      where: { name: planData.name },
    });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: planData,
      });
      console.log(`✅ Plan ${planData.name} actualizado`);
    } else {
      await prisma.plan.create({
        data: planData,
      });
      console.log(`✅ Plan ${planData.name} creado`);
    }
  }

  console.log("🎉 Seed completado!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
