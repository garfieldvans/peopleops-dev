import { createPrismaClient } from "@peopleops/database";

export const PRISMA_CLIENT = Symbol("WORKER_PRISMA_CLIENT");

export const prismaProvider = {
  provide: PRISMA_CLIENT,
  useFactory: () =>
    createPrismaClient({
      connectionString: process.env["DATABASE_URL"] ?? "",
    }),
};
