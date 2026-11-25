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

    // Leave rows use Restrict on employees and ledger sources, so clear them
    // explicitly before the employee fixtures are removed. This runs only on
    // the isolated e2e database.
    await prisma.leaveTransactionAllocation.deleteMany({});
    await prisma.leaveTransaction.deleteMany({});
    await prisma.leaveBalanceReservation.deleteMany({});
    await prisma.leaveAttachment.deleteMany({});
    await prisma.leaveRequestApproval.deleteMany({});
    await prisma.leaveRequestDay.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveEntitlementPeriod.deleteMany({});
    await prisma.leavePolicyAssignment.deleteMany({
      where: { OR: [{ employee: { employeeNumber: { startsWith: "E2E-" } } }] },
    });
    await prisma.leavePolicy.deleteMany({ where: { code: { startsWith: "E2E-" } } });
    await prisma.leaveType.deleteMany({ where: { code: { startsWith: "E2E_" } } });

    await prisma.employee.deleteMany({
      where: { employeeNumber: { startsWith: "E2E-" } },
    });
    await prisma.holiday.deleteMany({ where: { name: { startsWith: "E2E " } } });
    await prisma.shift.deleteMany({ where: { code: { startsWith: "E2E-" } } });
    await prisma.workSchedule.deleteMany({ where: { code: { startsWith: "E2E-" } } });
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
