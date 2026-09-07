"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { RegistrationServiceError, type RegistrationService } from "../application";
import {
  EMPTY_REGISTRATION_FORM,
  normalizeRegistrationData,
  validateRegistration,
  validateUsername,
  type PendingRegistration,
  type RegistrationErrors,
  type RegistrationFormData,
  type RegistrationStatus,
  type VerificationChannel,
} from "../domain";

export type UsernameCheckState = "IDLE" | "CHECKING" | "AVAILABLE" | "UNAVAILABLE";

type UseRegistrationOptions = {
  service: RegistrationService;
  initialStatus?: RegistrationStatus;
  onCompleted: () => void;
  onCancelled: () => void;
};

export function useRegistration({ service, initialStatus, onCompleted, onCancelled }: UseRegistrationOptions) {
  const verificationStatus = initialStatus?.stage === "VERIFICATION" ? initialStatus : undefined;
  const [stage, setStage] = useState<"LOADING" | "DETAILS" | "VERIFICATION">(
    initialStatus?.stage ?? "LOADING",
  );
  const [formData, setFormData] = useState<RegistrationFormData>(EMPTY_REGISTRATION_FORM);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState<PendingRegistration | undefined>(
    verificationStatus
      ? {
          registrationId: verificationStatus.registrationId,
          status: "PENDING_VERIFICATION",
          contacts: verificationStatus.contacts,
        }
      : undefined,
  );
  const [selectedChannel, setSelectedChannel] = useState<VerificationChannel | undefined>(
    verificationStatus?.selectedChannel,
  );
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [debugCode, setDebugCode] = useState<string>();
  const [resendSeconds, setResendSeconds] = useState(verificationStatus?.resendAvailableInSeconds ?? 0);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>("IDLE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const reportError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof RegistrationServiceError) {
      if (error.errors) setErrors((current) => ({ ...current, ...error.errors }));
      setFormError(error.message);
      return;
    }
    setFormError(fallback);
  }, []);

  useEffect(() => {
    if (initialStatus) return;
    let active = true;
    void service.getStatus().then((status) => {
      if (!active) return;
      if (status.stage === "DETAILS") {
        setStage("DETAILS");
        return;
      }
      setPending({
        registrationId: status.registrationId,
        status: "PENDING_VERIFICATION",
        contacts: status.contacts,
      });
      setSelectedChannel(status.selectedChannel);
      setResendSeconds(status.resendAvailableInSeconds);
      setStage("VERIFICATION");
    }).catch((error: unknown) => {
      if (active) reportError(error, "No fue posible recuperar el registro.");
    });
    return () => { active = false; };
  }, [initialStatus, reportError, service]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const updateField = useCallback(<K extends keyof RegistrationFormData>(
    field: K,
    value: RegistrationFormData[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(undefined);
    if (field === "username") setUsernameCheck("IDLE");
  }, []);

  const checkUsername = useCallback(async (): Promise<boolean> => {
    const usernameError = validateUsername(formData.username);
    if (usernameError) {
      setErrors((current) => ({ ...current, username: usernameError }));
      setUsernameCheck("UNAVAILABLE");
      return false;
    }
    setUsernameCheck("CHECKING");
    try {
      const availability = await service.checkUsername(formData.username);
      setUsernameCheck(availability.available ? "AVAILABLE" : "UNAVAILABLE");
      setErrors((current) => ({
        ...current,
        username: availability.available ? undefined : "El nombre de usuario ya existe.",
      }));
      return availability.available;
    } catch (error) {
      setUsernameCheck("IDLE");
      reportError(error, "No fue posible comprobar el nombre de usuario.");
      return false;
    }
  }, [formData.username, reportError, service]);

  const sendCode = useCallback(async (
    registration: PendingRegistration,
    channel: VerificationChannel,
  ): Promise<void> => {
    setIsSendingCode(true);
    setFormError(undefined);
    setCodeError(undefined);
    setCode("");
    try {
      const challenge = await service.sendVerificationCode({
        registrationId: registration.registrationId,
        channel,
      });
      setSelectedChannel(challenge.channel);
      setResendSeconds(challenge.resendAvailableInSeconds);
      setDebugCode(challenge.debugCode);
    } catch (error) {
      if (error instanceof RegistrationServiceError && error.code === "RESEND_TOO_SOON") {
        setResendSeconds(error.retryAfterSeconds ?? 0);
      }
      reportError(error, "No fue posible enviar el código de verificación.");
    } finally {
      setIsSendingCode(false);
    }
  }, [reportError, service]);

  const submitDetails = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = validateRegistration(formData);
    setErrors(nextErrors);
    setFormError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      const available = await checkUsername();
      if (!available) return;
      const registration = await service.startRegistration(normalizeRegistrationData(formData));
      setPending(registration);
      setSelectedChannel(undefined);
      setCode("");
      setCodeError(undefined);
      setDebugCode(undefined);
      setResendSeconds(0);
      setFormData((current) => ({ ...current, password: "", confirmPassword: "" }));
      setStage("VERIFICATION");
    } catch (error) {
      reportError(error, "No fue posible preparar la verificación.");
    } finally {
      setIsSubmitting(false);
    }
  }, [checkUsername, formData, isSubmitting, reportError, service]);

  const changeChannel = useCallback((channel: VerificationChannel) => {
    if (!pending || isSendingCode || isVerifying) return;
    void sendCode(pending, channel);
  }, [isSendingCode, isVerifying, pending, sendCode]);

  const resend = useCallback(() => {
    if (!pending || !selectedChannel || isSendingCode || resendSeconds > 0) return;
    void sendCode(pending, selectedChannel);
  }, [isSendingCode, pending, resendSeconds, selectedChannel, sendCode]);

  const verify = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending || !selectedChannel || isVerifying) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError("Ingresa el código de 6 dígitos.");
      return;
    }
    setIsVerifying(true);
    setCodeError(undefined);
    setFormError(undefined);
    try {
      await service.verifyCode({
        registrationId: pending.registrationId,
        channel: selectedChannel,
        code,
      });
      setFormData(EMPTY_REGISTRATION_FORM);
      setCode("");
      onCompleted();
    } catch (error) {
      if (error instanceof RegistrationServiceError) setCodeError(error.message);
      else reportError(error, "No fue posible verificar la cuenta.");
    } finally {
      setIsVerifying(false);
    }
  }, [code, isVerifying, onCompleted, pending, reportError, selectedChannel, service]);

  const backToDetails = useCallback(async (): Promise<void> => {
    if (isCancelling) return;
    setIsCancelling(true);
    setFormError(undefined);
    try {
      await service.cancel();
      setPending(undefined);
      setSelectedChannel(undefined);
      setCode("");
      setCodeError(undefined);
      setDebugCode(undefined);
      setResendSeconds(0);
      setFormData((current) => ({ ...current, password: "", confirmPassword: "" }));
      setStage("DETAILS");
    } catch (error) {
      reportError(error, "No fue posible volver al paso anterior.");
    } finally {
      setIsCancelling(false);
    }
  }, [isCancelling, reportError, service]);

  const cancel = useCallback(async () => {
    try {
      await service.cancel();
    } finally {
      setFormData(EMPTY_REGISTRATION_FORM);
      onCancelled();
    }
  }, [onCancelled, service]);

  return {
    stage,
    formData,
    errors,
    formError,
    pending,
    selectedChannel,
    code,
    codeError,
    debugCode,
    resendSeconds,
    usernameCheck,
    isSubmitting,
    isSendingCode,
    isVerifying,
    isCancelling,
    updateField,
    checkUsername,
    submitDetails,
    changeChannel,
    resend,
    setCode,
    verify,
    backToDetails,
    cancel,
  };
}
