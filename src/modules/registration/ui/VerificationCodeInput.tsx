"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import styles from "./Registration.module.css";

type VerificationCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

const CODE_LENGTH = 6;

export function VerificationCodeInput({ value, onChange, disabled, error }: VerificationCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? "");

  const replaceFrom = (index: number, raw: string) => {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) return;
    const next = [...digits];
    incoming.slice(0, CODE_LENGTH - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    onChange(next.join(""));
    refs.current[Math.min(index + incoming.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) next[index] = "";
      else if (index > 0) {
        next[index - 1] = "";
        refs.current[index - 1]?.focus();
      }
      onChange(next.join(""));
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    replaceFrom(0, event.clipboardData.getData("text"));
  };

  return (
    <div>
      <div className={styles.codeInputs} role="group" aria-label="Código de verificación de 6 dígitos">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => { refs.current[index] = node; }}
            className={styles.codeInput}
            value={digit}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            aria-label={`Dígito ${index + 1}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "verification-code-error" : undefined}
            onChange={(event) => replaceFrom(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
          />
        ))}
      </div>
      {error ? <p id="verification-code-error" className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
