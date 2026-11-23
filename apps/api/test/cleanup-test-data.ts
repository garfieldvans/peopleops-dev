import { config } from "dotenv";
import { createPrismaClient } from "@peopleops/database";

config({ path: [".env"], quiet: true });

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = createPrismaClient({ connectionString });

  try {
    await prisma.employee.updateMany({
      where: { employeeNumber: { startsWith: "E2E-" } },
      data: { managerId: null },
    });
    await prisma.employee.deleteMany({
      where: { employeeNumber: { startsWith: "E2E-" } },
    });
    await prisma.position.deleteMany({ where: { code: { startsWith: "E2E-" } } });
    await prisma.department.deleteMany({ where: { code: { startsWith: "E2E-" } } });
    await prisma.branch.deleteMany({ where: { code: { startsWith: "E2E-" } } });
    const removed = await prisma.user.deleteMany({
      where: { email: { startsWith: "e2e.", endsWith: "@peopleops.test" } },
    });
    await prisma.user.updateMany({
      where: { email: "admin@peopleops.test" },
      data: { status: "ACTIVE" },
    });
    console.log(`Cleaned ${removed.count} e2e fixture account(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
