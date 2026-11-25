import type { PrismaClient } from "@peopleops/database";

export async function getCompanyTimezone(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.findFirst({ select: { timezone: true } });
  return company?.timezone ?? "Asia/Jakarta";
}
