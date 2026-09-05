import { type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "style"> & {
  label: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  fieldClassName?: string;
  labelClassName?: string;
  inputWrapperClassName?: string;
  messageClassName?: string;
};

export function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightElement,
  fieldClassName,
  labelClassName,
  inputWrapperClassName,
  messageClassName,
  required,
  id,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const message = error ?? helperText;
  const messageId = message ? `${inputId}-message` : undefined;
  const describedBy = [ariaDescribedBy, messageId].filter(Boolean).join(" ") || undefined;
  const inputClassName = [
    styles.input,
    leftIcon ? styles.inputWithLeftIcon : "",
    rightElement ? styles.inputWithRightElement : "",
    error ? styles.inputError : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const resolvedMessageClassName = [
    styles.message,
    error ? styles.messageError : "",
    messageClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.field, fieldClassName].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={[styles.label, labelClassName].filter(Boolean).join(" ")}>
        {label} {required ? <span className={styles.required}>*</span> : null}
      </label>

      <div className={[styles.inputWrapper, inputWrapperClassName].filter(Boolean).join(" ")}>
        {leftIcon ? (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}

        <input
          id={inputId}
          {...props}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={inputClassName}
        />

        {rightElement ? <span className={styles.rightElement}>{rightElement}</span> : null}
      </div>

      {message ? (
        <span id={messageId} className={resolvedMessageClassName}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
