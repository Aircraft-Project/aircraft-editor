export {
  RegistrationServiceError,
} from "../application";
export type {
  RegistrationService,
} from "../application";
export {
  EMPTY_REGISTRATION_FORM,
  normalizeRegistrationData,
  normalizeUsername,
  validateRegistration,
  validateUsername,
} from "../domain";
export type {
  PendingRegistration,
  RegistrationErrors,
  RegistrationFormData,
  RegistrationStatus,
  VerificationChallenge,
  VerificationChannel,
} from "../domain";
export {
  HttpRegistrationService,
  registrationService,
} from "../infrastructure";

export { useRegistration } from './useRegistration';
export type { UsernameCheckState } from './useRegistration';
