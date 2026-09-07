import "server-only";

import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { createDeveloperAccount, hashPassword, isAccountUsernameAvailable } from "@/modules/accounts/server";
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
import {
  hasRegistrationErrors,
  isVerificationChannel,
  isVerificationCode,
  maskEmail,
  maskPhone,
  normalizeRegistrationData,
  normalizeUsername,
  validateRegistration,
  validateUsername,
} from "../domain";

export const PENDING_REGISTRATION_COOKIE = "aircraft.registration.pending";
export const PENDING_REGISTRATION_TTL_SECONDS = 15 * 60;
export const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
export const VERIFICATION_RESEND_SECONDS = 60;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const TERMS_VERSION = "1.0";
export const PRIVACY_POLICY_VERSION = "1.0";

type PendingRecord = {
  registrationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  username: string;
  marketingOptIn: boolean;
  passwordHash: string;
  passwordSalt: string;
  expiresAt: number;
  lastCodeSentAt?: number;
};

type ChallengeRecord = {
  registrationId: string;
  channel: VerificationChannel;
  codeHash: Buffer;
  codeSalt: string;
  attempts: number;
  expiresAt: number;
};

type RegistrationState = {
  pending: Map<string, PendingRecord>;
  challenges: Map<string, ChallengeRecord>;
};

type RegistrationGlobal = typeof globalThis & {
  __aircraftRegistrationState?: RegistrationState;
};

export type RegistrationServerResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: RegistrationErrorCode; message: string; errors?: RegistrationErrors; retryAfterSeconds?: number };

function state(): RegistrationState {
  const runtime = globalThis as RegistrationGlobal;
  runtime.__aircraftRegistrationState ??= { pending: new Map(), challenges: new Map() };
  return runtime.__aircraftRegistrationState;
}

function fail<T>(status: number, code: RegistrationErrorCode, message: string, extras: { errors?: RegistrationErrors; retryAfterSeconds?: number } = {}): RegistrationServerResult<T> {
  return { ok: false, status, code, message, ...extras };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRegistrationData(value: unknown): RegistrationFormData | null {
  if (!isRecord(value) || "role" in value) return null;
  const stringKeys = ["firstName", "lastName", "email", "phone", "birthDate", "username", "password", "confirmPassword"] as const;
  if (stringKeys.some((key) => typeof value[key] !== "string")) return null;
  if (typeof value.termsAccepted !== "boolean" || typeof value.marketingOptIn !== "boolean") return null;
  return {
    firstName: value.firstName as string,
    lastName: value.lastName as string,
    email: value.email as string,
    phone: value.phone as string,
    birthDate: value.birthDate as string,
    username: value.username as string,
    password: value.password as string,
    confirmPassword: value.confirmPassword as string,
    termsAccepted: value.termsAccepted,
    marketingOptIn: value.marketingOptIn,
  };
}

function readSendRequest(value: unknown): SendVerificationCodeRequest | null {
  if (!isRecord(value) || typeof value.registrationId !== "string" || !isVerificationChannel(value.channel)) return null;
  return { registrationId: value.registrationId, channel: value.channel };
}

function readVerifyRequest(value: unknown): VerifyRegistrationRequest | null {
  const request = readSendRequest(value);
  if (!request || !isRecord(value) || typeof value.code !== "string") return null;
  return { ...request, code: value.code };
}

function remainingSeconds(target: number, now: number): number {
  return Math.max(0, Math.ceil((target - now) / 1000));
}

function deletePending(registrationId: string): void {
  state().pending.delete(registrationId);
  state().challenges.delete(registrationId);
}

function getPending(registrationId: string | undefined, now: number): PendingRecord | null {
  if (!registrationId) return null;
  const pending = state().pending.get(registrationId);
  if (!pending) return null;
  if (pending.expiresAt <= now) {
    deletePending(registrationId);
    return null;
  }
  return pending;
}

function hashVerificationCode(code: string, salt: string): Buffer {
  return createHash("sha256").update(salt).update(code).digest();
}

function destinationFor(pending: PendingRecord, channel: VerificationChannel): string {
  return channel === "EMAIL" ? maskEmail(pending.email) : maskPhone(pending.phone);
}

export function checkUsername(rawUsername: unknown): RegistrationServerResult<UsernameAvailability> {
  if (typeof rawUsername !== "string") return fail(400, "INVALID_REGISTRATION_DATA", "El nombre de usuario no es válido.");
  const username = normalizeUsername(rawUsername);
  const validationError = validateUsername(username);
  if (validationError) return fail(400, "INVALID_REGISTRATION_DATA", validationError, { errors: { username: validationError } });
  return { ok: true, data: { username, available: isAccountUsernameAvailable(username) } };
}

export function startRegistration(
  body: unknown,
  previousRegistrationId?: string,
  now = Date.now(),
): RegistrationServerResult<PendingRegistration> {
  const parsed = readRegistrationData(body);
  if (!parsed) return fail(400, "INVALID_REGISTRATION_DATA", "Los datos del registro no son válidos.");
  const normalized = normalizeRegistrationData(parsed);
  const errors = validateRegistration(normalized, new Date(now));
  if (hasRegistrationErrors(errors)) return fail(400, "INVALID_REGISTRATION_DATA", "Revisa los datos ingresados.", { errors });
  if (!isAccountUsernameAvailable(normalized.username)) {
    return fail(409, "USERNAME_ALREADY_EXISTS", "El nombre de usuario ya existe.", { errors: { username: "El nombre de usuario ya existe." } });
  }

  if (previousRegistrationId) deletePending(previousRegistrationId);
  const registrationId = randomUUID();
  const passwordSalt = randomBytes(16).toString("base64url");
  const pending: PendingRecord = {
    registrationId,
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    email: normalized.email,
    phone: normalized.phone,
    birthDate: normalized.birthDate,
    username: normalized.username,
    marketingOptIn: normalized.marketingOptIn,
    passwordHash: hashPassword(parsed.password, passwordSalt),
    passwordSalt,
    expiresAt: now + PENDING_REGISTRATION_TTL_SECONDS * 1000,
  };
  state().pending.set(registrationId, pending);
  return {
    ok: true,
    data: {
      registrationId,
      status: "PENDING_VERIFICATION",
      contacts: { emailMasked: maskEmail(pending.email), phoneMasked: maskPhone(pending.phone) },
    },
  };
}

export function getRegistrationStatus(
  registrationId: string | undefined,
  now = Date.now(),
): RegistrationServerResult<RegistrationStatus> {
  const pending = getPending(registrationId, now);
  if (!pending) return { ok: true, data: { stage: "DETAILS" } };
  const challenge = state().challenges.get(pending.registrationId);
  return {
    ok: true,
    data: {
      stage: "VERIFICATION",
      registrationId: pending.registrationId,
      contacts: { emailMasked: maskEmail(pending.email), phoneMasked: maskPhone(pending.phone) },
      selectedChannel: challenge?.channel,
      resendAvailableInSeconds: pending.lastCodeSentAt
        ? remainingSeconds(pending.lastCodeSentAt + VERIFICATION_RESEND_SECONDS * 1000, now)
        : 0,
      codeExpiresInSeconds: challenge ? remainingSeconds(challenge.expiresAt, now) : 0,
    },
  };
}

export function sendVerificationCode(
  pendingRegistrationId: string | undefined,
  body: unknown,
  now = Date.now(),
): RegistrationServerResult<VerificationChallenge> {
  const request = readSendRequest(body);
  if (!request) return fail(400, "INVALID_REGISTRATION_DATA", "El medio de verificación no es válido.");
  if (!pendingRegistrationId || request.registrationId !== pendingRegistrationId) {
    return fail(404, "REGISTRATION_NOT_FOUND", "No se encontró el registro pendiente.");
  }
  const pending = getPending(pendingRegistrationId, now);
  if (!pending) return fail(404, "REGISTRATION_NOT_FOUND", "No se encontró el registro pendiente.");

  const resendAvailableAt = (pending.lastCodeSentAt ?? 0) + VERIFICATION_RESEND_SECONDS * 1000;
  if (pending.lastCodeSentAt && resendAvailableAt > now) {
    return fail(429, "RESEND_TOO_SOON", "Espera antes de solicitar un nuevo código.", {
      retryAfterSeconds: remainingSeconds(resendAvailableAt, now),
    });
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeSalt = randomBytes(16).toString("base64url");
  pending.lastCodeSentAt = now;
  state().challenges.set(pending.registrationId, {
    registrationId: pending.registrationId,
    channel: request.channel,
    codeHash: hashVerificationCode(code, codeSalt),
    codeSalt,
    attempts: 0,
    expiresAt: now + VERIFICATION_CODE_TTL_SECONDS * 1000,
  });
  return {
    ok: true,
    data: {
      channel: request.channel,
      maskedDestination: destinationFor(pending, request.channel),
      expiresInSeconds: VERIFICATION_CODE_TTL_SECONDS,
      resendAvailableInSeconds: VERIFICATION_RESEND_SECONDS,
      ...(process.env.NODE_ENV !== "production" ? { debugCode: code } : {}),
    },
  };
}

export function verifyRegistrationCode(
  pendingRegistrationId: string | undefined,
  body: unknown,
  now = Date.now(),
): RegistrationServerResult<RegisteredUser> {
  const request = readVerifyRequest(body);
  if (!request || !isVerificationCode(request.code)) return fail(400, "VERIFICATION_CODE_INVALID", "El código de verificación no es válido.");
  if (!pendingRegistrationId || request.registrationId !== pendingRegistrationId) {
    return fail(404, "REGISTRATION_NOT_FOUND", "No se encontró el registro pendiente.");
  }
  const pending = getPending(pendingRegistrationId, now);
  if (!pending) {
    return fail(404, "REGISTRATION_NOT_FOUND", "No se encontró el registro pendiente.");
  }
  const challenge = state().challenges.get(pendingRegistrationId);
  if (!challenge || challenge.channel !== request.channel) {
    return fail(400, "VERIFICATION_CODE_INVALID", "El código de verificación no es válido.");
  }
  if (challenge.expiresAt <= now) {
    state().challenges.delete(pendingRegistrationId);
    return fail(410, "VERIFICATION_CODE_EXPIRED", "El código de verificación expiró.");
  }

  const actualHash = hashVerificationCode(request.code, challenge.codeSalt);
  const matches = actualHash.length === challenge.codeHash.length && timingSafeEqual(actualHash, challenge.codeHash);
  if (!matches) {
    challenge.attempts += 1;
    if (challenge.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      state().challenges.delete(pendingRegistrationId);
      return fail(429, "VERIFICATION_ATTEMPTS_EXCEEDED", "Superaste el máximo de intentos. Solicita un nuevo código.");
    }
    return fail(401, "VERIFICATION_CODE_INVALID", "El código de verificación no es válido.");
  }

  try {
    const user = createDeveloperAccount({
      id: `usr-${randomUUID()}`,
      username: pending.username,
      passwordHash: pending.passwordHash,
      passwordSalt: pending.passwordSalt,
      profile: {
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        phone: pending.phone,
        birthDate: pending.birthDate,
        marketingOptIn: pending.marketingOptIn,
      },
      consent: {
        termsAcceptedAt: new Date(now).toISOString(),
        termsVersion: TERMS_VERSION,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      },
    });
    deletePending(pendingRegistrationId);
    return { ok: true, data: { user } };
  } catch {
    deletePending(pendingRegistrationId);
    return fail(409, "USERNAME_ALREADY_EXISTS", "El nombre de usuario ya existe.");
  }
}

export function cancelRegistration(registrationId: string | undefined): RegistrationServerResult<undefined> {
  if (registrationId) deletePending(registrationId);
  return { ok: true, data: undefined };
}

export function resetRegistrationStateForTests(): void {
  const runtime = globalThis as RegistrationGlobal;
  runtime.__aircraftRegistrationState = { pending: new Map(), challenges: new Map() };
}

