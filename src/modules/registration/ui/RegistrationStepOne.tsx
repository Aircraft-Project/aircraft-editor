"use client";

import { useState, type FormEventHandler } from "react";
import { AtSign, CalendarDays, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";

import { Button, Input } from "@/components/atoms";
import type { RegistrationErrors, RegistrationFormData } from "../domain";
import type { UsernameCheckState } from "../client/useRegistration";
import styles from "./Registration.module.css";

type RegistrationStepOneProps = {
  data: RegistrationFormData;
  errors: RegistrationErrors;
  formError?: string;
  usernameCheck: UsernameCheckState;
  isSubmitting: boolean;
  onChange: <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => void;
  onUsernameBlur: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
};

export function RegistrationStepOne({ data, errors, formError, usernameCheck, isSubmitting, onChange, onUsernameBlur, onSubmit, onCancel }: RegistrationStepOneProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const inputClasses = { fieldClassName: styles.field, labelClassName: styles.label, inputWrapperClassName: styles.inputWrapper, className: styles.input, messageClassName: styles.fieldMessage };

  return (
    <div className={styles.stepContent}>
      <header className={styles.stepHeader}>
        <div><h2>Crea tu cuenta</h2><p>Completa la información para comenzar a usar Aircraft Editor.</p></div>
        <div className={styles.progress}><span>Paso 1 de 2</span><i><b /></i></div>
      </header>
      <form onSubmit={onSubmit} noValidate className={styles.registrationForm}>
        <div className={styles.twoColumns}>
          <Input id="registration-first-name" label="Nombre" placeholder="Ingresa tu nombre" value={data.firstName} onChange={(event) => onChange("firstName", event.target.value)} autoComplete="given-name" aria-required="true" error={errors.firstName} leftIcon={<UserRound />} {...inputClasses} />
          <Input id="registration-last-name" label="Apellido" placeholder="Ingresa tu apellido" value={data.lastName} onChange={(event) => onChange("lastName", event.target.value)} autoComplete="family-name" aria-required="true" error={errors.lastName} leftIcon={<UserRound />} {...inputClasses} />
        </div>

        <Input id="registration-email" label="Correo electrónico" placeholder="tucorreo@ejemplo.com" type="email" value={data.email} onChange={(event) => onChange("email", event.target.value)} autoComplete="email" aria-required="true" error={errors.email} leftIcon={<Mail />} {...inputClasses} />

        <div className={styles.twoColumns}>
          <Input id="registration-phone" label="Número telefónico" placeholder="+57 300 123 4567" type="tel" value={data.phone} onChange={(event) => onChange("phone", event.target.value)} autoComplete="tel" aria-required="true" error={errors.phone} leftIcon={<Phone />} {...inputClasses} />
          <Input id="registration-birth-date" label="Fecha de nacimiento" type="date" value={data.birthDate} onChange={(event) => onChange("birthDate", event.target.value)} autoComplete="bday" aria-required="true" error={errors.birthDate} leftIcon={<CalendarDays />} {...inputClasses} />
        </div>

        <Input id="registration-username" label="Nombre de usuario" placeholder="Elige un nombre de usuario" value={data.username} onChange={(event) => onChange("username", event.target.value)} onBlur={onUsernameBlur} autoComplete="username" maxLength={32} aria-required="true" error={errors.username} helperText={usernameCheck === "CHECKING" ? "Comprobando disponibilidad..." : usernameCheck === "AVAILABLE" ? "Nombre de usuario disponible." : "Se usará para identificarte en Aircraft Editor."} leftIcon={<AtSign />} {...inputClasses} />

        <div className={styles.twoColumns}>
          <Input id="registration-password" label="Contraseña" placeholder="Crea una contraseña" type={showPassword ? "text" : "password"} value={data.password} onChange={(event) => onChange("password", event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} aria-required="true" error={errors.password} helperText="Mínimo 8 caracteres con letras, números y un símbolo." leftIcon={<LockKeyhole />} rightElement={<button type="button" className={styles.eyeButton} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button>} {...inputClasses} />
          <Input id="registration-password-confirmation" label="Confirmar contraseña" placeholder="Confirma tu contraseña" type={showConfirmation ? "text" : "password"} value={data.confirmPassword} onChange={(event) => onChange("confirmPassword", event.target.value)} autoComplete="new-password" aria-required="true" error={errors.confirmPassword} leftIcon={<LockKeyhole />} rightElement={<button type="button" className={styles.eyeButton} aria-label={showConfirmation ? "Ocultar confirmación" : "Mostrar confirmación"} onClick={() => setShowConfirmation((value) => !value)}>{showConfirmation ? <EyeOff /> : <Eye />}</button>} {...inputClasses} />
        </div>

        <label className={styles.checkboxRow}><input type="checkbox" checked={data.termsAccepted} onChange={(event) => onChange("termsAccepted", event.target.checked)} /><span>Acepto los <em>Términos y Condiciones</em> y la <em>Política de Privacidad</em>.</span></label>
        {errors.termsAccepted ? <p className={styles.error} role="alert">{errors.termsAccepted}</p> : null}
        <label className={styles.checkboxRow}><input type="checkbox" checked={data.marketingOptIn} onChange={(event) => onChange("marketingOptIn", event.target.checked)} /><span>Deseo recibir novedades y actualizaciones de Aircraft Editor.</span></label>
        {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
        <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className={styles.primaryButton} leftIcon={isSubmitting ? <LoaderCircle className={styles.spinner} /> : undefined}>{isSubmitting ? "Continuando..." : "Continuar"}</Button>
        <p className={styles.loginPrompt}>
          ¿Ya tienes una cuenta?{" "}
          <button type="button" className={styles.loginLink} onClick={onCancel}>Inicia sesión.</button>
        </p>
      </form>
    </div>
  );
}
