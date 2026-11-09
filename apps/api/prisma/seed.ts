import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.systemInfo.upsert({
    where: { key: 'schema-version' },
    update: { value: 'phase-1' },
    create: { key: 'schema-version', value: 'phase-1' },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
