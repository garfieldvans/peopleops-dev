import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@peopleops/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditEntry {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only security trail. A logging failure must never break the business
 * operation, so errors are logged and swallowed here.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          actorEmail: entry.actorEmail ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          ipAddress: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log (${entry.action})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
