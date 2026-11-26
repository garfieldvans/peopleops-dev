import { Prisma } from "@peopleops/database";
import type {
  EmployeeOffboarding,
  EmployeeOffboardingDetail,
  EmployeeOnboarding,
  EmployeeOnboardingDetail,
  OffboardingTask,
  OnboardingTask,
} from "@peopleops/shared-types";
import { displayName, isOverdue, isoDate } from "./onboarding.utils";

export const onboardingInclude = {
  employee: { include: { department: { select: { name: true } } } },
  template: { select: { id: true, name: true } },
  tasks: {
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.EmployeeOnboardingInclude;

export type OnboardingRow = Prisma.EmployeeOnboardingGetPayload<{
  include: typeof onboardingInclude;
}>;

export const offboardingInclude = {
  employee: { include: { department: { select: { name: true } } } },
  template: { select: { id: true, name: true } },
  tasks: {
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.EmployeeOffboardingInclude;

export type OffboardingRow = Prisma.EmployeeOffboardingGetPayload<{
  include: typeof offboardingInclude;
}>;

function progress(tasks: { status: string; dueDate: Date | null }[], today: string) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === "COMPLETED").length,
    overdue: tasks.filter((task) => isOverdue(task.dueDate, task.status, today)).length,
  };
}

function onboardingTask(row: OnboardingRow["tasks"][number], today: string): OnboardingTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    assignedTo: row.assignedTo,
    dueDate: isoDate(row.dueDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    overdue: isOverdue(row.dueDate, row.status, today),
  };
}

export function toOnboarding(row: OnboardingRow, today: string): EmployeeOnboarding {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
      department: row.employee.department?.name ?? null,
    },
    template: row.template,
    startDate: isoDate(row.startDate)!,
    expectedCompletionDate: isoDate(row.expectedCompletionDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    progress: progress(row.tasks, today),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOnboardingDetail(row: OnboardingRow, today: string): EmployeeOnboardingDetail {
  return { ...toOnboarding(row, today), tasks: row.tasks.map((task) => onboardingTask(task, today)) };
}

function offboardingTask(row: OffboardingRow["tasks"][number], today: string): OffboardingTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    assignedTo: row.assignedTo,
    dueDate: isoDate(row.dueDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    overdue: isOverdue(row.dueDate, row.status, today),
  };
}

export function toOffboarding(row: OffboardingRow, today: string): EmployeeOffboarding {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      fullName: displayName(row.employee),
      department: row.employee.department?.name ?? null,
    },
    template: row.template,
    resignationDate: isoDate(row.resignationDate)!,
    lastWorkingDate: isoDate(row.lastWorkingDate)!,
    reasonCategory: row.reasonCategory,
    reason: row.reason,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    progress: progress(row.tasks, today),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOffboardingDetail(
  row: OffboardingRow,
  today: string,
  sensitive: boolean,
  integrationNotes: string[],
): EmployeeOffboardingDetail {
  return {
    ...toOffboarding(row, today),
    tasks: row.tasks.map((task) => offboardingTask(task, today)),
    sensitive: {
      exitInterviewNotes: sensitive ? row.exitInterviewNotes : null,
      equipmentReturnNotes: sensitive ? row.equipmentReturnNotes : null,
      accessReviewNotes: sensitive ? row.accessReviewNotes : null,
    },
    integrationNotes,
  };
}
