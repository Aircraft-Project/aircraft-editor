"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { LoginForm } from "@/components/organisms";
import {
  authService,
  useLogin,
  type AuthService,
} from "@/modules/auth/client";
import { AircraftLoadingOverlay } from "@/shared/ui";

import styles from "./LoginView.module.css";

type LoginViewProps = {
  service?: AuthService;
  onCreateAccount?: () => void;
  registrationSucceeded?: boolean;
};

export function LoginView({
  service = authService,
  onCreateAccount,
  registrationSucceeded = false,
}: LoginViewProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  const handleAuthenticated = useCallback(() => {
    startNavigation(() => router.replace("/projects"));
  }, [router, startNavigation]);

  const handleCreateAccount = useCallback(() => {
    if (onCreateAccount) {
      onCreateAccount();
      return;
    }
    router.push("/register");
  }, [onCreateAccount, router]);

  const {
    credentials,
    errors,
    formError,
    isSubmitting,
    submit,
    updateCredential,
  } = useLogin({
    service,
    onAuthenticated: handleAuthenticated,
  });

  return (
    <>
      <main className={styles.page}>
        <Image
          src="/assets/auth/aircraft-login-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.background}
          aria-hidden="true"
        />
        <div className={styles.backdrop} aria-hidden="true" />

        <section className={styles.card} aria-label="Acceso a Aircraft Editor">
          <Image
            src="/assets/branding/aircraft-logo.svg"
            alt="Aircraft Editor"
            width={420}
            height={220}
            priority
            className={styles.logo}
          />

          <LoginForm
            credentials={credentials}
            errors={errors}
            formError={formError}
            isSubmitting={isSubmitting}
            registrationSucceeded={registrationSucceeded}
            onCredentialChange={updateCredential}
            onSubmit={submit}
            onCreateAccount={handleCreateAccount}
          />
        </section>
      </main>
      <AircraftLoadingOverlay
        open={isSubmitting || isNavigating}
        title="Iniciando sesión..."
        description="Preparando tu espacio de trabajo."
      />
    </>
  );
}
