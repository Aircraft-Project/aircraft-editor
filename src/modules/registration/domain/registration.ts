import type { SessionUser } from "@/modules/session";

export const REGISTRATION_STAGES = ["DETAILS", "VERIFICATION"] as const;
export const VERIFICATION_CHANNELS = ["EMAIL", "SMS"] as const;

export type RegistrationStage = (typeof REGISTRATION_STAGES)[number];
export type VerificationChannel = (typeof VERIFICATION_CHANNELS)[number];

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  username: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  marketingOptIn: boolean;
}

export interface RegistrationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
}

export interface MaskedContacts {
  emailMasked: string;
  phoneMasked: string;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
}

export interface PendingRegistration {
  registrationId: string;
  status: "PENDING_VERIFICATION";
  contacts: MaskedContacts;
}

export type RegistrationStatus =
  | { stage: "DETAILS" }
  | {
      stage: "VERIFICATION";
      registrationId: string;
      contacts: MaskedContacts;
      selectedChannel?: VerificationChannel;
      resendAvailableInSeconds: number;
      codeExpiresInSeconds: number;
    };

export interface VerificationChallenge {
  channel: VerificationChannel;
  maskedDestination: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  debugCode?: string;
}

export interface RegisteredUser { user: SessionUser }
export interface SendVerificationCodeRequest { registrationId: string; channel: VerificationChannel }
export interface VerifyRegistrationRequest extends SendVerificationCodeRequest { code: string }

export type RegistrationErrorCode =
  | "USERNAME_ALREADY_EXISTS"
  | "INVALID_REGISTRATION_DATA"
  | "REGISTRATION_NOT_FOUND"
  | "VERIFICATION_CODE_INVALID"
  | "VERIFICATION_CODE_EXPIRED"
  | "VERIFICATION_ATTEMPTS_EXCEEDED"
  | "RESEND_TOO_SOON"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export type RegistrationSuccessResponse<T> = { success: true; data: T };
export type RegistrationErrorResponse = {
  success: false;
  code: RegistrationErrorCode;
  message: string;
  errors?: RegistrationErrors;
  retryAfterSeconds?: number;
};
export type RegistrationApiResponse<T> = RegistrationSuccessResponse<T> | RegistrationErrorResponse;

export const EMPTY_REGISTRATION_FORM: RegistrationFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: "",
  username: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  marketingOptIn: false,
};


