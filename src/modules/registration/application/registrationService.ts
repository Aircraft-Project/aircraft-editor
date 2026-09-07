import type {
  PendingRegistration,
  RegisteredUser,
  RegistrationErrorCode,
  RegistrationErrors,
  RegistrationFormData,
  RegistrationStatus,
  SendVerificationCodeRequest,
  UsernameAvailability,
  VerificationChallenge,
  VerificationChannel,
  VerifyRegistrationRequest,
} from "../domain";

export class RegistrationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: RegistrationErrorCode,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
    public readonly errors?: RegistrationErrors,
  ) {
    super(message);
    this.name = "RegistrationServiceError";
  }
}

export interface RegistrationService {
  checkUsername(username: string): Promise<UsernameAvailability>;
  startRegistration(request: RegistrationFormData): Promise<PendingRegistration>;
  getStatus(): Promise<RegistrationStatus>;
  sendVerificationCode(request: SendVerificationCodeRequest): Promise<VerificationChallenge>;
  verifyCode(request: VerifyRegistrationRequest): Promise<RegisteredUser>;
  cancel(): Promise<void>;
}

export interface RegistrationControllerState {
  stage: "LOADING" | "DETAILS" | "VERIFICATION";
  selectedChannel?: VerificationChannel;
}
