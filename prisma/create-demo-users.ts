/**
 * Crear usuarios demo para beta testing
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: 'xisco@tradingbot.com', name: 'Xisco', password: 'xisco123' },
  { email: 'tester1@tradingbot.com', name: 'Tester 1', password: 'test1234' },
  { email: 'tester2@tradingbot.com', name: 'Tester 2', password: 'test1234' },
  { email: 'beta1@tradingbot.com', name: 'Beta 1', password: 'beta1234' },
  { email: 'beta2@tradingbot.com', name: 'Beta 2', password: 'beta1234' },
];

async function main() {
  // Get existing demo tenant
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'demo@tradingbot.com' }
  });

  if (!tenant) {
    console.error('No se encontró tenant demo');
    process.exit(1);
  }

  for (const user of DEMO_USERS) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { password: hashedPassword },
      create: {
        email: user.email,
        name: user.name,
        password: hashedPassword,
        tenantId: tenant.id,
      },
    });
    
    console.log(`✅ ${user.email} / ${user.password}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
