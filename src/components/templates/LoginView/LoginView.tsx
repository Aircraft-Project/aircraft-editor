"use client";

import { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/organisms";
import { useLogin } from "@/modules/auth/hooks";
import { authService, type AuthService } from "@/services/auth";
import styles from "./LoginView.module.css";

type LoginViewProps = {
  service?: AuthService;
  onCreateAccount?: () => void;
};

export function LoginView({ service = authService, onCreateAccount }: LoginViewProps) {
  const router = useRouter();

  const handleAuthenticated = useCallback(
    () => {
      router.replace("/projects");
    },
    [router],
  );

  const handleCreateAccount = useCallback(() => {
    // TODO(auth): connect this callback when the registration module is available.
    onCreateAccount?.();
  }, [onCreateAccount]);

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
          onCredentialChange={updateCredential}
          onSubmit={submit}
          onCreateAccount={handleCreateAccount}
        />
      </section>
    </main>
  );
}
