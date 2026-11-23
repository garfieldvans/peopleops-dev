import type { ComponentProps } from "react";
import { Input } from "@nemo-ui/ui";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

type NemoInputProps = ComponentProps<typeof Input>;

export interface FormInputProps<T extends FieldValues>
  extends Omit<NemoInputProps, "name" | "value" | "onChange" | "onBlur" | "error" | "ref"> {
  control: Control<T>;
  name: Path<T>;
}

/**
 * Nemo's Input exposes an imperative ref (focus/blur/select) instead of the DOM
 * node, so react-hook-form's `register` cannot read the typed value. Binding the
 * field through the controller keeps the input controlled and validated.
 */
export function FormInput<T extends FieldValues>({ control, name, ...rest }: FormInputProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <Input
      {...rest}
      name={field.name}
      value={(field.value as string | number | undefined) ?? ""}
      onBlur={field.onBlur}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  );
}
