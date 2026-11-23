import { Injectable, NotFoundException } from "@nestjs/common";
import type { EmergencyContact } from "@peopleops/shared-types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { ActorContext } from "./employees.service";
import { EmployeesService } from "./employees.service";
import { toEmergencyContact } from "./employee.mapper";
import type {
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
} from "./dto/employee.dto";

@Injectable()
export class EmergencyContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
  ) {}

  async list(employeeId: string, user: AuthenticatedUser): Promise<EmergencyContact[]> {
    await this.employees.assertCanReadEmployee(employeeId, user);
    const rows = await this.prisma.employeeEmergencyContact.findMany({
      where: { employeeId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toEmergencyContact);
  }

  async create(
    employeeId: string,
    dto: CreateEmergencyContactDto,
    actor: ActorContext,
  ): Promise<EmergencyContact> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.employeeEmergencyContact.count({ where: { employeeId } });
      const makePrimary = dto.isPrimary ?? existingCount === 0;

      if (makePrimary) {
        await tx.employeeEmergencyContact.updateMany({
          where: { employeeId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.employeeEmergencyContact.create({
        data: {
          employeeId,
          fullName: dto.fullName.trim(),
          relationship: dto.relationship.trim(),
          phone: dto.phone?.trim() ?? "",
          email: dto.email?.trim().toLowerCase() ?? null,
          address: dto.address?.trim() ?? null,
          isPrimary: makePrimary,
        },
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.emergency_contact_created",
      entityType: "employee_emergency_contact",
      entityId: row.id,
      metadata: { employeeId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmergencyContact(row);
  }

  async update(
    employeeId: string,
    contactId: string,
    dto: UpdateEmergencyContactDto,
    actor: ActorContext,
  ): Promise<EmergencyContact> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.employeeEmergencyContact.findFirst({
        where: { id: contactId, employeeId },
      });
      if (!existing) {
        throw new NotFoundException({
          code: "EMERGENCY_CONTACT_NOT_FOUND",
          message: "Emergency contact not found",
        });
      }

      if (dto.isPrimary === true) {
        await tx.employeeEmergencyContact.updateMany({
          where: { employeeId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }

      return tx.employeeEmergencyContact.update({
        where: { id: contactId },
        data: {
          fullName: dto.fullName !== undefined ? dto.fullName.trim() : undefined,
          relationship: dto.relationship !== undefined ? dto.relationship.trim() : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() ?? "" : undefined,
          email:
            dto.email !== undefined
              ? dto.email?.trim().toLowerCase() ?? null
              : undefined,
          address: dto.address !== undefined ? dto.address?.trim() ?? null : undefined,
          isPrimary: dto.isPrimary,
        },
      });
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.emergency_contact_updated",
      entityType: "employee_emergency_contact",
      entityId: contactId,
      metadata: { employeeId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toEmergencyContact(updated);
  }

  async remove(employeeId: string, contactId: string, actor: ActorContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.employeeEmergencyContact.findFirst({
        where: { id: contactId, employeeId },
      });
      if (!existing) {
        throw new NotFoundException({
          code: "EMERGENCY_CONTACT_NOT_FOUND",
          message: "Emergency contact not found",
        });
      }

      await tx.employeeEmergencyContact.delete({ where: { id: contactId } });

      if (existing.isPrimary) {
        const next = await tx.employeeEmergencyContact.findFirst({
          where: { employeeId },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await tx.employeeEmergencyContact.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "employee.emergency_contact_deleted",
      entityType: "employee_emergency_contact",
      entityId: contactId,
      metadata: { employeeId },
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });
  }
}
