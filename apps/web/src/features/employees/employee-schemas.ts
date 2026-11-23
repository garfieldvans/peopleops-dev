import { z } from "zod";

const optionalText = (max: number) => z.string().max(max, `At most ${max} characters`).optional();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));
const emailOrEmpty = z.union([z.string().email("Enter a valid email"), z.literal("")]).optional();

export const EMPLOYMENT_TYPE_OPTIONS = [
  { label: "Permanent", value: "PERMANENT" },
  { label: "Contract", value: "CONTRACT" },
  { label: "Intern", value: "INTERN" },
  { label: "Freelance", value: "FREELANCE" },
  { label: "Part time", value: "PART_TIME" },
] as const;

export const EMPLOYMENT_STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Probation", value: "PROBATION" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Resigned", value: "RESIGNED" },
  { label: "Terminated", value: "TERMINATED" },
] as const;

export const GENDER_OPTIONS = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { label: "Single", value: "SINGLE" },
  { label: "Married", value: "MARRIED" },
  { label: "Divorced", value: "DIVORCED" },
  { label: "Widowed", value: "WIDOWED" },
] as const;

export const employeeSchema = z.object({
  employeeNumber: z.string().max(32).optional(),
  firstName: z.string().min(1, "First name is required").max(80),
  middleName: optionalText(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  preferredName: optionalText(80),
  gender: z.string().optional(),
  birthDate: isoDate,
  placeOfBirth: optionalText(80),
  maritalStatus: z.string().optional(),
  nationality: optionalText(80),
  personalEmail: z.string().email("Enter a valid email"),
  phone: optionalText(40),
  addressLine: optionalText(200),
  city: optionalText(80),
  province: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  workEmail: emailOrEmpty,
  employmentType: z.enum(["PERMANENT", "CONTRACT", "INTERN", "FREELANCE", "PART_TIME"]),
  employmentStatus: z
    .enum(["ACTIVE", "PROBATION", "INACTIVE", "RESIGNED", "TERMINATED"])
    .optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Join date is required"),
  probationEndDate: isoDate,
  contractStartDate: isoDate,
  contractEndDate: isoDate,
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().min(1, "Choose a position"),
  jobLevelId: z.string().optional(),
  managerId: z.string().optional(),
  effectiveDate: isoDate,
  changeReason: optionalText(200),
});

export type EmployeeFormInput = z.input<typeof employeeSchema>;

export const emergencyContactSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(80),
  relationship: z.string().min(1, "Relationship is required").max(60),
  phone: z.string().min(1, "Phone is required").max(40),
  email: emailOrEmpty,
  address: optionalText(200),
  isPrimary: z.boolean().optional(),
});

export type EmergencyContactFormInput = z.input<typeof emergencyContactSchema>;
