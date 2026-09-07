"use client";

import { ArrowLeft, Clock3, Info, LoaderCircle, Mail, MessageSquare, RefreshCw } from "lucide-react";
import type { FormEventHandler } from "react";

import { Button } from "@/components/atoms";
import type { PendingRegistration, VerificationChannel } from "../domain";
import { VerificationCodeInput } from "./VerificationCodeInput";
import styles from "./Registration.module.css";

type RegistrationStepTwoProps = {
  pending: PendingRegistration;
  selectedChannel?: VerificationChannel;
  code: string;
  codeError?: string;
  formError?: string;
  debugCode?: string;
  resendSeconds: number;
  isSendingCode: boolean;
  isVerifying: boolean;
  isCancelling: boolean;
  onChannelChange: (channel: VerificationChannel) => void;
  onCodeChange: (value: string) => void;
  onResend: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBack: () => void;
};

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function RegistrationStepTwo({ pending, selectedChannel, code, codeError, formError, debugCode, resendSeconds, isSendingCode, isVerifying, isCancelling, onChannelChange, onCodeChange, onResend, onSubmit, onBack }: RegistrationStepTwoProps) {
  const description = selectedChannel === "EMAIL"
    ? "Ingresa el código de 6 dígitos que enviamos a tu correo electrónico."
    : "Ingresa el código de 6 dígitos que enviamos a tu teléfono.";

  return (
    <div className={styles.stepContent}>
      <button type="button" className={styles.backButton} onClick={onBack} disabled={isCancelling || isSendingCode || isVerifying}>
        {isCancelling ? <LoaderCircle className={styles.spinner} size={18} /> : <ArrowLeft size={18} />}
        {isCancelling ? "Volviendo..." : "Volver al paso anterior"}
      </button>
      <header className={styles.stepHeader}>
        <div><h2>Verifica tu cuenta</h2><p>Para proteger tu cuenta, necesitamos confirmar tu identidad.<br />Elige cómo deseas recibir el código de verificación.</p></div>
        <div className={`${styles.progress} ${styles.progressComplete}`}><span>Paso 2 de 2</span><i><b /></i></div>
      </header>
      <form onSubmit={onSubmit} className={styles.verificationForm}>
        <fieldset className={styles.channelFieldset} disabled={isSendingCode || isVerifying || isCancelling}>
          <legend>Selecciona un medio de verificación</legend>
          <div className={styles.channelGrid}>
            <label className={`${styles.channelCard} ${selectedChannel === "EMAIL" ? styles.channelSelected : ""}`}>
              <input type="radio" name="verification-channel" value="EMAIL" checked={selectedChannel === "EMAIL"} onChange={() => onChannelChange("EMAIL")} />
              <span className={styles.channelIcon}><Mail /></span><strong>Correo electrónico</strong><small>Recibe el código en<br />{pending.contacts.emailMasked}</small>
            </label>
            <label className={`${styles.channelCard} ${selectedChannel === "SMS" ? styles.channelSelected : ""}`}>
              <input type="radio" name="verification-channel" value="SMS" checked={selectedChannel === "SMS"} onChange={() => onChannelChange("SMS")} />
              <span className={styles.channelIcon}><MessageSquare /></span><strong>Mensaje de texto (SMS)</strong><small>Recibe el código en<br />{pending.contacts.phoneMasked}</small>
            </label>
          </div>
        </fieldset>
        <div className={styles.infoBox}><Info /><span>Puedes elegir cualquiera de los dos medios. Si uno no está disponible, puedes usar el otro.</span></div>
        {selectedChannel ? (
          <>
            <section className={styles.codeSection}>
              <h3>Código de verificación</h3>
              <p>{description}</p>
              <VerificationCodeInput value={code} onChange={onCodeChange} disabled={isVerifying || isSendingCode || isCancelling} error={codeError} />
              {debugCode ? <p className={styles.debugCode}>Código de desarrollo: <strong>{debugCode}</strong></p> : null}
            </section>
            <div className={styles.resendBox}>
              <Clock3 />
              <span><small>Puedes solicitar un nuevo código en:</small><strong>{formatTimer(resendSeconds)}</strong></span>
              <i />
              <Button type="button" variant="secondary" disabled={resendSeconds > 0 || isSendingCode || isVerifying || isCancelling} onClick={onResend} leftIcon={<RefreshCw className={isSendingCode ? styles.spinner : ""} />}>{isSendingCode ? "Enviando..." : "Reenviar código"}</Button>
            </div>
            <p className={styles.spamHint}>¿No recibiste el código? <span>Revisa tu carpeta de spam.</span></p>
            {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
            <Button type="submit" size="lg" disabled={isVerifying || isSendingCode || isCancelling || code.length !== 6} aria-busy={isVerifying} className={styles.primaryButton} leftIcon={isVerifying ? <LoaderCircle className={styles.spinner} /> : undefined}>{isVerifying ? "Verificando cuenta..." : "Verificar cuenta"}</Button>
            <div className={styles.bottomRule} />
          </>
        ) : formError ? (
          <p className={styles.error} role="alert">{formError}</p>
        ) : null}
      </form>
    </div>
  );
}
