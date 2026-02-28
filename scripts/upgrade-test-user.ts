/**
 * Script to upgrade test user to ENTERPRISE (VIP) plan
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find test user
  const tenant = await prisma.tenant.findUnique({
    where: { email: "test@test.com" },
  });

  if (!tenant) {
    console.log("Test user not found. Run create-test-user.ts first.");
    return;
  }

  console.log("Found tenant:", tenant.id);

  // Update or create subscription
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { plan: "ENTERPRISE", status: "ACTIVE" },
    });
    console.log("Updated subscription to ENTERPRISE (VIP)");
  } else {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: "ENTERPRISE",
        status: "ACTIVE",
      },
    });
    console.log("Created ENTERPRISE (VIP) subscription");
  }

  console.log("\n========================================");
  console.log("Test user upgraded to VIP!");
  console.log("Tenant ID:", tenant.id);
  console.log("========================================");
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(() => prisma.$disconnect());
