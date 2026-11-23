import type { ComponentProps } from "react";
import { DatePicker } from "@nemo-ui/ui";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

type NemoDatePickerProps = ComponentProps<typeof DatePicker>;

export interface FormDatePickerProps<T extends FieldValues>
  extends Omit<NemoDatePickerProps, "value" | "onChange" | "error" | "ref"> {
  control: Control<T>;
  name: Path<T>;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function FormDatePicker<T extends FieldValues>({
  control,
  name,
  ...rest
}: FormDatePickerProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <DatePicker
      {...(rest as object)}
      name={field.name}
      value={parseIsoDate(field.value)}
      onChange={(date: Date | null) => field.onChange(toIsoDate(date))}
      error={fieldState.error?.message}
      format="yyyy-mm-dd"
      fullWidth
    />
  );
}
