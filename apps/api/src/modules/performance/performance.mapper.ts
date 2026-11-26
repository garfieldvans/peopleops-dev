import { Prisma } from "@peopleops/database";
import type {
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalDetail,
  PerformanceReview,
} from "@peopleops/shared-types";
import { displayName, isoDate } from "../onboarding/onboarding.utils";

export const performanceGoalInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true } },
  cycle: { select: { id: true, name: true, status: true } },
  updates: {
    include: { updatedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PerformanceGoalInclude;

export type PerformanceGoalRow = Prisma.PerformanceGoalGetPayload<{
  include: typeof performanceGoalInclude;
}>;

export const performanceReviewInclude = {
  cycle: { select: { id: true, name: true } },
  employee: { select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true } },
  reviewer: { select: { id: true, name: true } },
  items: {
    include: { goal: { select: { title: true } } },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.PerformanceReviewInclude;

export type PerformanceReviewRow = Prisma.PerformanceReviewGetPayload<{
  include: typeof performanceReviewInclude;
}>;

export function toCycle(row: {
  id: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  reviewStartDate: Date;
  reviewEndDate: Date;
  status: PerformanceCycle["status"];
  createdAt: Date;
  updatedAt: Date;
  _count?: { goals: number; reviews: number };
}): PerformanceCycle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: isoDate(row.startDate)!,
    endDate: isoDate(row.endDate)!,
    reviewStartDate: isoDate(row.reviewStartDate)!,
    reviewEndDate: isoDate(row.reviewEndDate)!,
    status: row.status,
    goalCount: row._count?.goals,
    reviewCount: row._count?.reviews,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGoal(row: PerformanceGoalRow): PerformanceGoal {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
    },
    cycle: row.cycle,
    title: row.title,
    description: row.description,
    category: row.category,
    measurementType: row.measurementType,
    targetValue: row.targetValue?.toFixed(2) ?? null,
    currentValue: row.currentValue?.toFixed(2) ?? null,
    weight: row.weight.toFixed(2),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGoalDetail(row: PerformanceGoalRow): PerformanceGoalDetail {
  return {
    ...toGoal(row),
    updates: row.updates.map((update) => ({
      id: update.id,
      previousValue: update.previousValue?.toFixed(2) ?? null,
      newValue: update.newValue?.toFixed(2) ?? null,
      comment: update.comment,
      updatedBy: update.updatedBy,
      createdAt: update.createdAt.toISOString(),
    })),
  };
}

export function toReview(row: PerformanceReviewRow, includeInternal: boolean): PerformanceReview {
  return {
    id: row.id,
    cycle: row.cycle,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
    },
    reviewer: row.reviewer,
    reviewType: row.reviewType,
    status: row.status,
    overallRating: row.overallRating?.toFixed(1) ?? null,
    summary: row.summary,
    ...(includeInternal ? { internalNotes: row.internalNotes } : {}),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    items: row.items.map((item) => ({
      id: item.id,
      goalId: item.goalId,
      goalTitle: item.goal?.title ?? null,
      rating: item.rating?.toFixed(1) ?? null,
      comments: item.comments,
      evidence: item.evidence,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
