"use client";

import { useState, type FormEventHandler } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { Button, Input } from "@/components/atoms";
import { LOGIN_USERNAME_MAX_LENGTH, type LoginCredentials, type LoginErrors } from "@/modules/auth/types";
import styles from "./LoginForm.module.css";

type LoginFormProps = {
  credentials: LoginCredentials;
  errors: LoginErrors;
  formError?: string;
  registrationSucceeded?: boolean;
  isSubmitting: boolean;
  onCredentialChange: (field: keyof LoginCredentials, value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCreateAccount: () => void;
};

export function LoginForm({
  credentials,
  errors,
  formError,
  registrationSucceeded,
  isSubmitting,
  onCredentialChange,
  onSubmit,
  onCreateAccount,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {registrationSucceeded ? (
        <p className={styles.successMessage} role="status">
          Cuenta creada correctamente. Ya puedes iniciar sesión.
        </p>
      ) : null}
      <Input
        id="username"
        name="username"
        label="Usuario"
        placeholder="Ingresa tu usuario"
        value={credentials.username}
        onChange={(event) => onCredentialChange("username", event.target.value)}
        autoComplete="username"
        maxLength={LOGIN_USERNAME_MAX_LENGTH}
        aria-required="true"
        error={errors.username}
        leftIcon={<UserRound size={24} strokeWidth={1.8} />}
        fieldClassName={styles.field}
        labelClassName={styles.label}
        inputWrapperClassName={styles.inputWrapper}
        className={styles.input}
        messageClassName={styles.message}
      />

      <Input
        id="password"
        name="password"
        label="Contraseña"
        placeholder="Ingresa tu contraseña"
        type={showPassword ? "text" : "password"}
        value={credentials.password}
        onChange={(event) => onCredentialChange("password", event.target.value)}
        autoComplete="current-password"
        aria-required="true"
        error={errors.password}
        leftIcon={<LockKeyhole size={23} strokeWidth={1.8} />}
        rightElement={
          <button
            type="button"
            className={styles.visibilityButton}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        }
        fieldClassName={styles.field}
        labelClassName={styles.label}
        inputWrapperClassName={styles.inputWrapper}
        className={styles.input}
        messageClassName={styles.message}
      />

      <div className={styles.submitArea}>
        {formError ? <p className={styles.formError} role="alert" aria-live="polite">{formError}</p> : null}
        <Button
          type="submit"
          size="lg"
          className={styles.submitButton}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          leftIcon={isSubmitting ? <LoaderCircle className={styles.loader} size={21} /> : undefined}
        >
          {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </div>

      <p className={styles.registerPrompt}>
        ¿No tenés una cuenta?{" "}
        <button type="button" className={styles.registerButton} onClick={onCreateAccount}>
          Creá tu cuenta.
        </button>
      </p>
    </form>
  );
}
