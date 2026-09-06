"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { setSession, type AuthSession } from "@/modules/session";
import type { LoginCredentials, LoginErrors } from "@/modules/auth/types";
import { hasLoginErrors, normalizeLoginCredentials, validateLogin } from "@/modules/auth/validation";
import { AuthServiceError, type AuthService } from "../application/authService";

const INITIAL_CREDENTIALS: LoginCredentials = {
  username: "",
  password: "",
};

type UseLoginOptions = {
  service: AuthService;
  onAuthenticated: (session: AuthSession) => void;
};

export function useLogin({ service, onAuthenticated }: UseLoginOptions) {
  const [credentials, setCredentials] = useState<LoginCredentials>(INITIAL_CREDENTIALS);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgress = useRef(false);

  const updateCredential = useCallback((field: keyof LoginCredentials, value: string) => {
    setCredentials((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
    setFormError(undefined);
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitInProgress.current) return;

      const normalizedCredentials = normalizeLoginCredentials(credentials);
      const validationErrors = validateLogin(normalizedCredentials);

      setCredentials(normalizedCredentials);
      setErrors(validationErrors);
      setFormError(undefined);

      if (hasLoginErrors(validationErrors)) return;

      submitInProgress.current = true;
      setIsSubmitting(true);

      try {
        const session = await service.login(normalizedCredentials);
        setSession(session);
        setCredentials((current) => ({ ...current, password: "" }));
        onAuthenticated(session);
      } catch (error) {
        setFormError(
          error instanceof AuthServiceError
            ? error.message
            : "No pudimos iniciar sesión. Intentá nuevamente.",
        );
      } finally {
        submitInProgress.current = false;
        setIsSubmitting(false);
      }
    },
    [credentials, onAuthenticated, service],
  );

  return {
    credentials,
    errors,
    formError,
    isSubmitting,
    submit,
    updateCredential,
  };
}
