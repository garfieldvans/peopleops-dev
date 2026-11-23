import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@peopleops/database";
import type { Company } from "@peopleops/shared-types";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { RequestMeta } from "../../../common/http/request-meta";
import type { UpdateCompanyDto } from "./dto/update-company.dto";

type CompanyRow = Awaited<ReturnType<PrismaService["company"]["findFirstOrThrow"]>>;

export function toCompany(row: CompanyRow): Company {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface ActorContext {
  actorUserId: string;
  actorEmail: string;
  meta: RequestMeta;
}

/** The deployment is single-company: the profile is one row, updated in place. */
@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<Company> {
    const company = await this.prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) {
      throw new NotFoundException({
        code: "COMPANY_NOT_CONFIGURED",
        message: "The company profile has not been seeded yet",
      });
    }
    return toCompany(company);
  }

  async update(dto: UpdateCompanyDto, actor: ActorContext): Promise<Company> {
    const current = await this.prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!current) {
      throw new NotFoundException({
        code: "COMPANY_NOT_CONFIGURED",
        message: "The company profile has not been seeded yet",
      });
    }

    const updated = await this.prisma.company.update({
      where: { id: current.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.registrationNumber !== undefined ? { registrationNumber: dto.registrationNumber } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.province !== undefined ? { province: dto.province } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
      },
    });

    await this.audit.record({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      action: "company.updated",
      entityType: "company",
      entityId: updated.id,
      metadata: { before: toCompany(current), after: toCompany(updated) } as unknown as Prisma.InputJsonValue,
      ip: actor.meta.ip,
      userAgent: actor.meta.userAgent,
    });

    return toCompany(updated);
  }
}
