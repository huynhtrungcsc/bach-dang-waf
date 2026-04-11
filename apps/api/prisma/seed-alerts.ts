import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAlerts() {
  console.log('Seeding default alert rules...');

  await prisma.alertRule.upsert({
    where: { id: 'ar1' },
    update: {},
    create: {
      id: 'ar1',
      name: 'High CPU Usage',
      condition: 'cpu > threshold',
      threshold: 80,
      severity: 'warning',
      enabled: true,
    }
  });

  await prisma.alertRule.upsert({
    where: { id: 'ar2' },
    update: {},
    create: {
      id: 'ar2',
      name: 'Backend Down',
      condition: 'http_status == 0',
      threshold: 1,
      severity: 'critical',
      enabled: true,
    }
  });

  await prisma.alertRule.upsert({
    where: { id: 'ar3' },
    update: {},
    create: {
      id: 'ar3',
      name: 'SSL Certificate Expiring Soon',
      condition: 'ssl_days_remaining < threshold',
      threshold: 30,
      severity: 'warning',
      enabled: true,
    }
  });

  console.log('Alert rules seeded successfully.');
}

seedAlerts()
  .catch((e) => {
    console.error('Error seeding alerts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
