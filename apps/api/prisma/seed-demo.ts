import { config } from "dotenv";
import argon2 from "argon2";
import { DateTime } from "luxon";
import { createPrismaClient } from "@peopleops/database";
import { ROLE_CODES, type RoleCode } from "@peopleops/shared-types";

config({ path: ["../../.env", ".env"], quiet: true });

/**
 * Development helper: one account per role with a known password, so the app can
 * be exercised locally without hunting for generated seeds. Never run against a
 * production database — it refuses to start when NODE_ENV=production.
 */
const DEMO_PASSWORD = process.env["SEED_DEMO_PASSWORD"] ?? "PeopleOps#2026dev";

const ACCOUNTS: { name: string; email: string; role: RoleCode }[] = [
  { name: "Demo Super Admin", email: "superadmin@peopleops.local", role: ROLE_CODES.SUPER_ADMIN },
  { name: "Demo HR Admin", email: "hr@peopleops.local", role: ROLE_CODES.HR_ADMIN },
  { name: "Demo Manager", email: "manager@peopleops.local", role: ROLE_CODES.MANAGER },
  { name: "Demo Employee", email: "employee@peopleops.local", role: ROLE_CODES.EMPLOYEE },
  { name: "Demo Payroll", email: "payroll@peopleops.local", role: ROLE_CODES.PAYROLL_OFFICER },
];

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("The demo seed is development-only; it refuses to run in production");
  }

  if (DEMO_PASSWORD.length < 12) {
    throw new Error("SEED_DEMO_PASSWORD must be at least 12 characters");
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const prisma = createPrismaClient({ connectionString });

  try {
    const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

    for (const account of ACCOUNTS) {
      const role = await prisma.role.findUnique({ where: { code: account.role } });
      if (!role) {
        throw new Error(`Role ${account.role} does not exist — run "pnpm db:seed" first`);
      }

      const user = await prisma.user.upsert({
        where: { email: account.email },
        create: {
          name: account.name,
          email: account.email,
          passwordHash,
          status: "ACTIVE",
        },
        update: { name: account.name, passwordHash, status: "ACTIVE" },
      });

      const linked = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id },
        select: { id: true },
      });
      if (!linked) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }

    // Sample organization so the master-data screens have something to show.
    const branches = [
      { code: "HQ-JKT", name: "Jakarta HQ", city: "Jakarta Selatan", province: "DKI Jakarta" },
      { code: "BR-BDG", name: "Bandung Office", city: "Bandung", province: "Jawa Barat" },
      { code: "BR-SBY", name: "Surabaya Office", city: "Surabaya", province: "Jawa Timur" },
    ];
    for (const branch of branches) {
      await prisma.branch.upsert({
        where: { code: branch.code },
        create: { ...branch, address: null, status: "ACTIVE" },
        update: {},
      });
    }

    const hq = await prisma.branch.findUniqueOrThrow({ where: { code: "HQ-JKT" } });

    const departments: { code: string; name: string; parentCode?: string }[] = [
      { code: "ENG", name: "Engineering" },
      { code: "ENG-BE", name: "Backend Engineering", parentCode: "ENG" },
      { code: "ENG-FE", name: "Frontend Engineering", parentCode: "ENG" },
      { code: "PROD", name: "Product" },
      { code: "HR", name: "People & Culture" },
      { code: "FIN", name: "Finance" },
    ];
    for (const department of departments) {
      const parent = department.parentCode
        ? await prisma.department.findUniqueOrThrow({ where: { code: department.parentCode } })
        : null;
      await prisma.department.upsert({
        where: { code: department.code },
        create: {
          code: department.code,
          name: department.name,
          branchId: hq.id,
          parentId: parent?.id ?? null,
          status: "ACTIVE",
        },
        update: {},
      });
    }

    const positions: { code: string; title: string; departmentCode: string; levelCode: string }[] = [
      { code: "POS-BE", title: "Backend Engineer", departmentCode: "ENG-BE", levelCode: "L2" },
      { code: "POS-FE", title: "Frontend Engineer", departmentCode: "ENG-FE", levelCode: "L2" },
      { code: "POS-EM", title: "Engineering Manager", departmentCode: "ENG", levelCode: "L4" },
      { code: "POS-HR", title: "HR Generalist", departmentCode: "HR", levelCode: "L2" },
      { code: "POS-FA", title: "Finance Analyst", departmentCode: "FIN", levelCode: "L2" },
    ];
    for (const position of positions) {
      const department = await prisma.department.findUniqueOrThrow({
        where: { code: position.departmentCode },
      });
      const jobLevel = await prisma.jobLevel.findUnique({ where: { code: position.levelCode } });
      await prisma.position.upsert({
        where: { code: position.code },
        create: {
          code: position.code,
          title: position.title,
          departmentId: department.id,
          jobLevelId: jobLevel?.id ?? null,
          status: "ACTIVE",
        },
        update: {},
      });
    }

    // Sample employees: a manager with two reports (one linked account), an HR
    // employee linked to the HR account, and one payroll employee with no user.
    const findUser = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
    const [managerUser, employeeUser, hrUser] = await Promise.all([
      findUser("manager@peopleops.local"),
      findUser("employee@peopleops.local"),
      findUser("hr@peopleops.local"),
    ]);

    const demoEmployees: {
      employeeNumber: string;
      firstName: string;
      lastName: string;
      personalEmail: string;
      positionCode: string;
      managerNumber?: string;
      userId?: string;
      joinDate: Date;
    }[] = [
      {
        employeeNumber: "EMP-0001",
        firstName: "Dimas",
        lastName: "Pratama",
        personalEmail: "dimas.pratama@example.com",
        positionCode: "POS-EM",
        userId: managerUser.id,
        joinDate: new Date("2024-01-08T00:00:00.000Z"),
      },
      {
        employeeNumber: "EMP-0002",
        firstName: "Rina",
        lastName: "Lestari",
        personalEmail: "rina.lestari@example.com",
        positionCode: "POS-FE",
        managerNumber: "EMP-0001",
        userId: employeeUser.id,
        joinDate: new Date("2024-06-03T00:00:00.000Z"),
      },
      {
        employeeNumber: "EMP-0003",
        firstName: "Bayu",
        lastName: "Santoso",
        personalEmail: "bayu.santoso@example.com",
        positionCode: "POS-BE",
        managerNumber: "EMP-0001",
        joinDate: new Date("2025-02-17T00:00:00.000Z"),
      },
      {
        employeeNumber: "EMP-0004",
        firstName: "Sari",
        lastName: "Wulandari",
        personalEmail: "sari.wulandari@example.com",
        positionCode: "POS-HR",
        userId: hrUser.id,
        joinDate: new Date("2024-03-11T00:00:00.000Z"),
      },
    ];

    for (const demo of demoEmployees) {
      const position = await prisma.position.findUniqueOrThrow({
        where: { code: demo.positionCode },
        include: { department: true },
      });
      const manager = demo.managerNumber
        ? await prisma.employee.findUnique({ where: { employeeNumber: demo.managerNumber } })
        : null;

      const employee = await prisma.employee.upsert({
        where: { employeeNumber: demo.employeeNumber },
        create: {
          employeeNumber: demo.employeeNumber,
          firstName: demo.firstName,
          lastName: demo.lastName,
          personalEmail: demo.personalEmail,
          workEmail: demo.personalEmail.replace("@example.com", "@peopleops.local"),
          employmentType: "PERMANENT",
          employmentStatus: "ACTIVE",
          joinDate: demo.joinDate,
          branchId: position.department.branchId,
          departmentId: position.departmentId,
          positionId: position.id,
          jobLevelId: position.jobLevelId,
          managerId: manager?.id ?? null,
          userId: demo.userId ?? null,
          country: "Indonesia",
        },
        update: {},
      });

      const history = await prisma.employmentHistory.findFirst({
        where: { employeeId: employee.id, effectiveTo: null },
        select: { id: true },
      });
      if (!history) {
        await prisma.employmentHistory.create({
          data: {
            employeeId: employee.id,
            effectiveFrom: employee.joinDate,
            employmentType: employee.employmentType,
            employmentStatus: employee.employmentStatus,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            positionId: employee.positionId,
            jobLevelId: employee.jobLevelId,
            managerId: employee.managerId,
            changeReason: "Initial employment",
          },
        });
      }
    }

    // Attendance demo: a standard weekday schedule, a night shift, effective-dated
    // assignments, holidays, and a short attendance history for the employee login.
    const timezone = "Asia/Jakarta";
    const schedule = await prisma.workSchedule.upsert({
      where: { code: "WS-STANDARD" },
      update: {},
      create: {
        name: "Standard Weekday",
        code: "WS-STANDARD",
        description: "Monday to Friday, 08:00–17:00 with a one-hour break",
        graceLateMinutes: 10,
        graceEarlyMinutes: 5,
      },
    });

    for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
      const working = dayOfWeek <= 5;
      await prisma.workScheduleDay.upsert({
        where: { scheduleId_dayOfWeek: { scheduleId: schedule.id, dayOfWeek } },
        update: {},
        create: {
          scheduleId: schedule.id,
          dayOfWeek,
          isWorkingDay: working,
          startTime: working ? "08:00" : null,
          endTime: working ? "17:00" : null,
          breakMinutes: working ? 60 : 0,
        },
      });
    }

    await prisma.shift.upsert({
      where: { code: "SHIFT-NIGHT" },
      update: {},
      create: {
        name: "Night Shift",
        code: "SHIFT-NIGHT",
        description: "22:00–06:00 across midnight",
        startTime: "22:00",
        endTime: "06:00",
        breakMinutes: 30,
        graceLateMinutes: 10,
        graceEarlyMinutes: 5,
      },
    });

    const nightShift = await prisma.shift.findUniqueOrThrow({
      where: { code: "SHIFT-NIGHT" },
    });
    const assignments: { employeeNumber: string; shiftId: string | null }[] = [
      { employeeNumber: "EMP-0001", shiftId: null },
      { employeeNumber: "EMP-0002", shiftId: null },
      { employeeNumber: "EMP-0003", shiftId: nightShift.id },
      { employeeNumber: "EMP-0004", shiftId: null },
    ];
    for (const assignment of assignments) {
      const employee = await prisma.employee.findUniqueOrThrow({
        where: { employeeNumber: assignment.employeeNumber },
      });
      await prisma.employeeScheduleAssignment.upsert({
        where: {
          employeeId_effectiveFrom: {
            employeeId: employee.id,
            effectiveFrom: employee.joinDate,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          workScheduleId: schedule.id,
          shiftId: assignment.shiftId,
          effectiveFrom: employee.joinDate,
          changeReason: "Demo schedule assignment",
        },
      });
    }

    for (const holiday of [
      { name: "Indonesian Independence Day", date: "2026-08-17", type: "NATIONAL" as const },
      { name: "Christmas Day", date: "2026-12-25", type: "NATIONAL" as const },
      { name: "Company Anniversary", date: "2026-10-01", type: "COMPANY" as const },
    ]) {
      const date = new Date(`${holiday.date}T00:00:00.000Z`);
      const existing = await prisma.holiday.findFirst({ where: { date, branchId: null } });
      if (!existing) {
        await prisma.holiday.create({
          data: {
            name: holiday.name,
            date,
            type: holiday.type,
            status: "ACTIVE",
          },
        });
      }
    }

    const sampleEmployee = await prisma.employee.findUniqueOrThrow({
      where: { employeeNumber: "EMP-0002" },
    });
    const sampleAssignment = await prisma.employeeScheduleAssignment.findFirstOrThrow({
      where: { employeeId: sampleEmployee.id },
      orderBy: { effectiveFrom: "desc" },
    });
    const sampleDays: string[] = [];
    let cursor = DateTime.now().setZone(timezone).startOf("day");
    while (sampleDays.length < 3) {
      cursor = cursor.minus({ days: 1 });
      if (cursor.weekday <= 5) sampleDays.push(cursor.toFormat("yyyy-MM-dd"));
    }

    const samples = [
      { in: "08:24", out: "17:02", status: "LATE" as const, late: 14, early: 0, worked: 458 },
      { in: "08:02", out: "16:40", status: "EARLY_LEAVE" as const, late: 0, early: 15, worked: 458 },
      { in: "08:01", out: "17:05", status: "PRESENT" as const, late: 0, early: 0, worked: 484 },
    ];

    for (let index = 0; index < sampleDays.length; index += 1) {
      const day = sampleDays[index]!;
      const sample = samples[index]!;
      const workDate = new Date(`${day}T00:00:00.000Z`);
      const startAt = DateTime.fromISO(`${day}T${sample.in}`, { zone: timezone }).toUTC().toJSDate();
      const endAt = DateTime.fromISO(`${day}T${sample.out}`, { zone: timezone }).toUTC().toJSDate();
      const scheduledStartAt = DateTime.fromISO(`${day}T08:00`, { zone: timezone })
        .toUTC()
        .toJSDate();
      const scheduledEndAt = DateTime.fromISO(`${day}T17:00`, { zone: timezone })
        .toUTC()
        .toJSDate();

      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_workDate: { employeeId: sampleEmployee.id, workDate },
        },
      });
      if (!existing) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: sampleEmployee.id,
            scheduleAssignmentId: sampleAssignment.id,
            workScheduleId: schedule.id,
            workDate,
            timezone,
            scheduledStartAt,
            scheduledEndAt,
            expectedBreakMinutes: 60,
            graceLateMinutes: 10,
            graceEarlyMinutes: 5,
            clockInAt: startAt,
            clockOutAt: endAt,
            status: sample.status,
            lateMinutes: sample.late,
            earlyLeaveMinutes: sample.early,
            workedMinutes: sample.worked,
            breakMinutesTaken: 60,
            breaks: {
              create: {
                startedAt: DateTime.fromISO(`${day}T12:00`, { zone: timezone })
                  .toUTC()
                  .toJSDate(),
                endedAt: DateTime.fromISO(`${day}T13:00`, { zone: timezone })
                  .toUTC()
                  .toJSDate(),
              },
            },
          },
        });
      }
    }

    const latestDay = sampleDays[0];
    if (latestDay) {
      const workDate = new Date(`${latestDay}T00:00:00.000Z`);
      const existing = await prisma.attendanceCorrection.findFirst({
        where: { employeeId: sampleEmployee.id, workDate, status: "PENDING" },
      });
      if (!existing) {
        const requestedClockIn = DateTime.fromISO(`${latestDay}T08:15`, { zone: timezone })
          .toUTC()
          .toJSDate();
        const requestedClockOut = DateTime.fromISO(`${latestDay}T17:02`, { zone: timezone })
          .toUTC()
          .toJSDate();
        await prisma.attendanceCorrection.create({
          data: {
            employeeId: sampleEmployee.id,
            workDate,
            type: "CLOCK_IN",
            status: "PENDING",
            requestedClockInAt: requestedClockIn,
            requestedClockOutAt: requestedClockOut,
            originalClockInAt: DateTime.fromISO(`${latestDay}T08:24`, { zone: timezone })
              .toUTC()
              .toJSDate(),
            originalClockOutAt: requestedClockOut,
            reason: "Traffic made me arrive later than my actual start time.",
          },
        });
      }
    }

    console.log(`Demo accounts ready (${ACCOUNTS.length}).`);
    for (const account of ACCOUNTS) {
      console.log(`  ${account.role.padEnd(16)} ${account.email}`);
    }
    console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
    console.log("Development only — change SEED_DEMO_PASSWORD if these accounts leave your machine.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
