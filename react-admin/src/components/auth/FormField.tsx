import type { FC } from "react";

export type FieldProps = {
  readonly label: string;
  readonly name: string;
  readonly type: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly hint?: string;
  readonly className?: string;
};

export const FormField: FC<FieldProps> = ({
  label,
  name,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  hint,
  className,
}) => (
  <label className={className}>
    <span>{label}</span>
    <input
      name={name}
      type={type}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
    />
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
);
