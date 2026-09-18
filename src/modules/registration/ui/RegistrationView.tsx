"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { AircraftLoadingOverlay } from "@/shared/ui";

import {
  registrationService,
  type RegistrationService,
  type RegistrationStatus,
  useRegistration,
} from "../client";
import { RegistrationShell } from "./RegistrationShell";
import { RegistrationStepOne } from "./RegistrationStepOne";
import { RegistrationStepTwo } from "./RegistrationStepTwo";

type RegistrationViewProps = {
  service?: RegistrationService;
  initialStatus?: RegistrationStatus;
};

export function RegistrationView({
  service = registrationService,
  initialStatus,
}: RegistrationViewProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const onCompleted = useCallback(() => {
    startNavigation(() => router.replace("/?registered=1"));
  }, [router, startNavigation]);
  const onCancelled = useCallback(() => router.replace("/"), [router]);
  const registration = useRegistration({
    service,
    initialStatus,
    onCompleted,
    onCancelled,
  });

  const overlayContent =
    registration.stage === "LOADING"
      ? {
          title: "Recuperando tu registro...",
          description: "Preparando tu información.",
        }
      : registration.isVerifying || isNavigating
        ? {
            title: "Verificando tu cuenta...",
            description: "Estamos validando tu código.",
          }
        : {
            title: "Preparando tu registro...",
            description: "Configurando tu experiencia.",
          };

  return (
    <>
      <RegistrationShell>
        {registration.stage === "LOADING" ? null : registration.stage ===
          "DETAILS" ? (
          <RegistrationStepOne
            data={registration.formData}
            errors={registration.errors}
            formError={registration.formError}
            usernameCheck={registration.usernameCheck}
            isSubmitting={registration.isSubmitting}
            onChange={registration.updateField}
            onUsernameBlur={() => {
              void registration.checkUsername();
            }}
            onSubmit={registration.submitDetails}
            onCancel={() => {
              void registration.cancel();
            }}
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
            onBack={() => {
              void registration.backToDetails();
            }}
          />
        ) : null}
      </RegistrationShell>
      <AircraftLoadingOverlay
        open={
          registration.stage === "LOADING" ||
          registration.isSubmitting ||
          registration.isVerifying ||
          isNavigating
        }
        title={overlayContent.title}
        description={overlayContent.description}
      />
    </>
  );
}
