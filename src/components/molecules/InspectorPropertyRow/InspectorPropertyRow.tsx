import { Input } from "@/components/atoms";

type InspectorPropertyRowProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  required?: boolean;
  error?: string;
};

export function InspectorPropertyRow({ label, value, onChange, required, error }: InspectorPropertyRowProps) {
  return (
    <Input
      label={label}
      required={required}
      value={value}
      error={error}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
