import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

export * from "@prisma/client";

export interface PrismaConnectionOptions {
  connectionString: string;
  log?: Prisma.LogLevel[];
}

/**
 * `?schema=` is honored by the Prisma CLI but NOT by the driver adapter, so it
 * has to be forwarded explicitly. Tests rely on this for an isolated schema.
 */
function schemaFromConnectionString(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shared Prisma client. Prisma 7 runs without the Rust engine, so every client
 * must be constructed with a driver adapter (verified against 7.10.1: a bare
 * `new PrismaClient()` throws PrismaClientInitializationError).
 */
export class PeopleOpsPrismaClient extends PrismaClient {
  constructor({ connectionString, log = ["warn", "error"] }: PrismaConnectionOptions) {
    const schema = schemaFromConnectionString(connectionString);
    super({
      adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
      log,
    });
  }
}

export function createPrismaClient(options: PrismaConnectionOptions): PeopleOpsPrismaClient {
  return new PeopleOpsPrismaClient(options);
}
