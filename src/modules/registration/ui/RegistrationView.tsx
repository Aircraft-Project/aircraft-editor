"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  registrationService,
  type RegistrationService,
  type RegistrationStatus,
  useRegistration,
} from "../client";
import { RegistrationShell } from "./RegistrationShell";
import { RegistrationStepOne } from "./RegistrationStepOne";
import { RegistrationStepTwo } from "./RegistrationStepTwo";
import styles from "./Registration.module.css";

type RegistrationViewProps = {
  service?: RegistrationService;
  initialStatus?: RegistrationStatus;
};

export function RegistrationView({
  service = registrationService,
  initialStatus,
}: RegistrationViewProps) {
  const router = useRouter();
  const onCompleted = useCallback(() => router.replace("/?registered=1"), [router]);
  const onCancelled = useCallback(() => router.replace("/"), [router]);
  const registration = useRegistration({
    service,
    initialStatus,
    onCompleted,
    onCancelled,
  });

  return (
    <RegistrationShell>
      {registration.stage === "LOADING" ? (
        <div className={styles.loading} role="status"><LoaderCircle className={styles.spinner} /> Recuperando registro...</div>
      ) : registration.stage === "DETAILS" ? (
        <RegistrationStepOne
          data={registration.formData}
          errors={registration.errors}
          formError={registration.formError}
          usernameCheck={registration.usernameCheck}
          isSubmitting={registration.isSubmitting}
          onChange={registration.updateField}
          onUsernameBlur={() => { void registration.checkUsername(); }}
          onSubmit={registration.submitDetails}
          onCancel={() => { void registration.cancel(); }}
        />
      ) : registration.pending ? (
        <RegistrationStepTwo
          pending={registration.pending}
          selectedChannel={registration.selectedChannel}
          code={registration.code}
          codeError={registration.codeError}
          formError={registration.formError}
          debugCode={registration.debugCode}
          resendSeconds={registration.resendSeconds}
          isSendingCode={registration.isSendingCode}
          isVerifying={registration.isVerifying}
          isCancelling={registration.isCancelling}
          onChannelChange={registration.changeChannel}
          onCodeChange={registration.setCode}
          onResend={registration.resend}
          onSubmit={registration.verify}
          onBack={() => { void registration.backToDetails(); }}
        />
      ) : null}
    </RegistrationShell>
  );
}
