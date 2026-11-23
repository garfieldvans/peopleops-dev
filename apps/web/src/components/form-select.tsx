import type { ComponentProps } from "react";
import { Select } from "@nemo-ui/ui";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

type NemoSelectProps = ComponentProps<typeof Select>;

export interface FormSelectProps<T extends FieldValues>
  extends Omit<NemoSelectProps, "name" | "value" | "onChange" | "error"> {
  control: Control<T>;
  name: Path<T>;
}

/** Nemo's Select is value-based (`onChange(value: string)`), so it is bound through
 * a controller rather than `register`. */
export function FormSelect<T extends FieldValues>({ control, name, ...rest }: FormSelectProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <Select
      {...rest}
      name={field.name}
      value={(field.value as string | undefined) ?? ""}
      onChange={(value: string) => field.onChange(value === "" ? null : value)}
      error={fieldState.error?.message}
    />
  );
}
