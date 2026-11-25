import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import argon2 from "argon2";
import { createPrismaClient } from "@peopleops/database";
import { ROLE_CODES } from "@peopleops/shared-types";
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from "../src/modules/rbac/rbac.constants";

config({ path: ["../../.env", ".env"], quiet: true });

function generatePassword(): string {
  // 24 random bytes -> base64url, always contains letters and digits in practice;
  // suffix guarantees the policy even in a pathological draw.
  return `${randomBytes(18).toString("base64url")}a1`;
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const prisma = createPrismaClient({ connectionString });

  try {
    // 1. Permissions (stable codes, idempotent upsert).
    for (const permission of PERMISSION_DEFINITIONS) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { name: permission.name, description: permission.description },
      });
    }

    // 2. Roles.
    for (const role of ROLE_DEFINITIONS) {
      await prisma.role.upsert({
        where: { code: role.code },
        create: {
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        },
        update: {
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        },
      });
    }

    // 3. Role -> permission links, replaced to match the definitions exactly.
    for (const roleDefinition of ROLE_DEFINITIONS) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleDefinition.code } });
      const permissions = await prisma.permission.findMany({
        where: { code: { in: [...roleDefinition.permissions] } },
        select: { id: true },
      });

      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        prisma.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        }),
      ]);
    }

    // 4. Company profile (single-company deployment: one row, seeded once).
    await prisma.company.upsert({
      where: { code: "PEOPLEOPS" },
      create: {
        name: process.env["SEED_COMPANY_NAME"] ?? "PeopleOps Indonesia",
        code: "PEOPLEOPS",
        email: process.env["SEED_COMPANY_EMAIL"] ?? "hello@peopleops.local",
        phone: "+62 21 5550 1000",
        website: "https://peopleops.local",
        addressLine: "Jl. Jenderal Sudirman Kav. 52-53",
        city: "Jakarta Selatan",
        province: "DKI Jakarta",
        postalCode: "12190",
        country: "Indonesia",
        timezone: "Asia/Jakarta",
        currency: "IDR",
      },
      // Never overwrite edits made through the app.
      update: {},
    });

    // 4b. Payroll settings and non-statutory starter components.
    const payrollSettings = await prisma.payrollSetting.findFirst();
    if (!payrollSettings) {
      await prisma.payrollSetting.create({ data: {} });
    }
    const payrollComponents = [
      {
        code: "TRANSPORT_ALLOWANCE",
        name: "Transport allowance",
        componentType: "EARNING" as const,
        calculationType: "FIXED_AMOUNT" as const,
        defaultAmount: "500000.00",
      },
      {
        code: "MEAL_ALLOWANCE",
        name: "Meal allowance",
        componentType: "EARNING" as const,
        calculationType: "FIXED_AMOUNT" as const,
        defaultAmount: "300000.00",
      },
      {
        code: "ABSENCE_DEDUCTION",
        name: "Absence deduction",
        componentType: "DEDUCTION" as const,
        calculationType: "SOURCE_BASED" as const,
        defaultAmount: "0.00",
        sourceType: "ABSENCE" as const,
        rateMultiplier: "1.0000",
      },
      {
        code: "LATE_DEDUCTION",
        name: "Late arrival deduction",
        componentType: "DEDUCTION" as const,
        calculationType: "SOURCE_BASED" as const,
        defaultAmount: "0.00",
        sourceType: "LATE" as const,
        rateMultiplier: "1.0000",
      },
      {
        code: "UNPAID_LEAVE_DEDUCTION",
        name: "Unpaid leave deduction",
        componentType: "DEDUCTION" as const,
        calculationType: "SOURCE_BASED" as const,
        defaultAmount: "0.00",
        sourceType: "UNPAID_LEAVE" as const,
        rateMultiplier: "1.0000",
      },
      {
        code: "OVERTIME_PAY",
        name: "Overtime pay",
        componentType: "EARNING" as const,
        calculationType: "SOURCE_BASED" as const,
        defaultAmount: "0.00",
        sourceType: "OVERTIME" as const,
        rateMultiplier: "1.0000",
      },
    ];
    for (const component of payrollComponents) {
      await prisma.payrollComponent.upsert({
        where: { code: component.code },
        create: {
          ...component,
          description: "Starter configuration; adjust to match company policy.",
          effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
          isActive: true,
        },
        update: {},
      });
    }

    // 5. Job levels (reference data, ordered).
    const jobLevels = [
      { code: "L1", name: "Staff", displayOrder: 1 },
      { code: "L2", name: "Senior Staff", displayOrder: 2 },
      { code: "L3", name: "Supervisor", displayOrder: 3 },
      { code: "L4", name: "Manager", displayOrder: 4 },
      { code: "L5", name: "Director", displayOrder: 5 },
    ];
    for (const level of jobLevels) {
      await prisma.jobLevel.upsert({
        where: { code: level.code },
        create: { ...level, description: null },
        update: {},
      });
    }

    // 6. First administrator. Existing accounts are never overwritten.
    const adminEmail = (process.env["SEED_ADMIN_EMAIL"] ?? "admin@peopleops.local")
      .trim()
      .toLowerCase();
    const adminName = process.env["SEED_ADMIN_NAME"] ?? "PeopleOps Administrator";
    const configuredPassword = process.env["SEED_ADMIN_PASSWORD"];
    const superAdminRole = await prisma.role.findUniqueOrThrow({
      where: { code: ROLE_CODES.SUPER_ADMIN },
    });

    let created = false;
    let generatedPassword: string | null = null;

    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    let admin = existing;

    if (!admin) {
      if (configuredPassword && configuredPassword.length < 12) {
        throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
      }
      generatedPassword = configuredPassword ?? generatePassword();
      admin = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash: await argon2.hash(generatedPassword, { type: argon2.argon2id }),
          status: "ACTIVE",
        },
      });
      created = true;
    }

    const hasSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: superAdminRole.id },
    });

    if (!hasSuperAdmin) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: superAdminRole.id },
      });
    }

    // Never print a configured password; only the generated one, exactly once.
    console.log(`Seed complete: ${PERMISSION_DEFINITIONS.length} permissions, ${ROLE_DEFINITIONS.length} roles.`);
    if (created) {
      console.log(`Administrator created: ${adminEmail}`);
      if (generatedPassword && !configuredPassword) {
        console.log(`One-time generated password: ${generatedPassword}`);
        console.log("Store it safely and change it after the first login.");
      }
    } else {
      console.log(`Administrator exists: ${adminEmail} (password unchanged, SUPER_ADMIN ensured).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
