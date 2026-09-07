import { cookies } from "next/headers";

import { RegistrationView } from "@/modules/registration/ui";
import {
  PENDING_REGISTRATION_COOKIE,
  getRegistrationStatus,
} from "@/modules/registration/server";
import type { RegistrationStatus } from "@/modules/registration";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const registrationId = cookieStore.get(PENDING_REGISTRATION_COOKIE)?.value;
  const result = getRegistrationStatus(registrationId);
  const initialStatus: RegistrationStatus = result.ok ? result.data : { stage: "DETAILS" };
  return <RegistrationView initialStatus={initialStatus} />;
}
