import { z } from "zod";

const code = z
  .string()
  .min(2, "At least 2 characters")
  .max(24, "At most 24 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only");

const optionalText = (max: number) => z.string().max(max, `At most ${max} characters`).optional();

export const branchSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(120),
  code,
  address: optionalText(240),
  city: optionalText(96),
  province: optionalText(96),
  postalCode: optionalText(16),
  phone: optionalText(32),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
});
export type BranchFormInput = z.input<typeof branchSchema>;

export const departmentSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(120),
  code,
  description: optionalText(400),
  branchId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});
export type DepartmentFormInput = z.input<typeof departmentSchema>;

export const positionSchema = z.object({
  title: z.string().min(2, "At least 2 characters").max(120),
  code,
  description: optionalText(400),
  departmentId: z.string().min(1, "Choose a department"),
  jobLevelId: z.string().optional().nullable(),
});
export type PositionFormInput = z.input<typeof positionSchema>;

export const jobLevelSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(120),
  code,
  description: optionalText(400),
  displayOrder: z.coerce.number().int().min(0).max(999),
});
export type JobLevelFormInput = z.input<typeof jobLevelSchema>;

export const companySchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(160),
  code: z.string().min(2).max(32).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only"),
  registrationNumber: optionalText(64),
  email: z.string().email("Enter a valid email"),
  phone: optionalText(32),
  website: optionalText(200),
  addressLine: optionalText(240),
  city: optionalText(96),
  province: optionalText(96),
  postalCode: optionalText(16),
  country: z.string().min(2).max(96),
  timezone: z.string().min(1).max(64),
  currency: z.string().length(3, "Use a 3-letter code"),
});
export type CompanyFormInput = z.input<typeof companySchema>;

/** Empty strings become null so nullable columns stay nullable. */
export function nullifyEmpty(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]),
  );
}
