jest.mock("server-only", () => ({}));

import {
  authenticateAccount,
  findAccountDetailsByUsername,
  resetMockAccountsForTests,
} from "@/modules/accounts/server";
import { EMPTY_REGISTRATION_FORM } from "../domain";
import {
  PENDING_REGISTRATION_TTL_SECONDS,
  VERIFICATION_CODE_TTL_SECONDS,
  VERIFICATION_RESEND_SECONDS,
  cancelRegistration,
  checkUsername,
  getRegistrationStatus,
  resetRegistrationStateForTests,
  sendVerificationCode,
  startRegistration,
  verifyRegistrationCode,
  type RegistrationServerResult,
} from "./registrationServer";

const NOW = new Date("2026-04-01T12:00:00Z").getTime();
const validForm = {
  ...EMPTY_REGISTRATION_FORM,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ADA@Example.COM",
  phone: "+57 300 123 4567",
  birthDate: "1990-12-10",
  username: "Ada.Dev",
  password: "Secure#123",
  confirmPassword: "Secure#123",
  termsAccepted: true,
  marketingOptIn: true,
};

function valueOf<T>(result: RegistrationServerResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

function pendingRegistration(username = "ada.dev") {
  return valueOf(startRegistration({ ...validForm, username }, undefined, NOW));
}

describe("registration server", () => {
  beforeEach(() => {
    resetRegistrationStateForTests();
    resetMockAccountsForTests();
  });

  it("keeps public access in DETAILS and checks usernames without creating pending state", () => {
    expect(getRegistrationStatus(undefined, NOW)).toEqual({ ok: true, data: { stage: "DETAILS" } });
    expect(valueOf(checkUsername(" ADMIN "))).toEqual({ username: "admin", available: false });
    expect(valueOf(checkUsername("New.User"))).toEqual({ username: "new.user", available: true });
    expect(checkUsername(42)).toMatchObject({ ok: false, status: 400 });
    expect(checkUsername("bad user")).toMatchObject({ ok: false, code: "INVALID_REGISTRATION_DATA" });
    expect(getRegistrationStatus(undefined, NOW)).toEqual({ ok: true, data: { stage: "DETAILS" } });
  });

  it("rejects invalid fields, reserved usernames, and malicious roles", () => {
    expect(startRegistration({ ...validForm, email: "bad" }, undefined, NOW)).toMatchObject({
      ok: false,
      code: "INVALID_REGISTRATION_DATA",
      errors: { email: expect.any(String) },
    });
    expect(startRegistration({ ...validForm, role: "ADMIN" }, undefined, NOW)).toMatchObject({
      ok: false,
      code: "INVALID_REGISTRATION_DATA",
    });
    expect(startRegistration({ ...validForm, username: "developer" }, undefined, NOW)).toMatchObject({
      ok: false,
      code: "USERNAME_ALREADY_EXISTS",
      errors: { username: "El nombre de usuario ya existe." },
    });
  });

  it("creates safe pending state only after start and does not select or send a channel", () => {
    const pending = pendingRegistration();
    const serialized = JSON.stringify(pending);
    expect(serialized).not.toContain("Secure#123");
    expect(serialized).not.toContain("password");
    expect(pending.contacts.emailMasked).not.toBe(validForm.email);
    expect(getRegistrationStatus(pending.registrationId, NOW)).toEqual({
      ok: true,
      data: expect.objectContaining({
        stage: "VERIFICATION",
        registrationId: pending.registrationId,
        selectedChannel: undefined,
        resendAvailableInSeconds: 0,
        codeExpiresInSeconds: 0,
      }),
    });
  });

  it("requires a valid registrationId for protected Step 2 operations", () => {
    const pending = pendingRegistration();
    expect(sendVerificationCode(undefined, { registrationId: pending.registrationId, channel: "EMAIL" }, NOW)).toMatchObject({
      ok: false,
      status: 404,
      code: "REGISTRATION_NOT_FOUND",
    });
    expect(sendVerificationCode("other", { registrationId: pending.registrationId, channel: "EMAIL" }, NOW)).toMatchObject({
      ok: false,
      status: 404,
      code: "REGISTRATION_NOT_FOUND",
    });
    expect(verifyRegistrationCode("missing", { registrationId: "missing", channel: "EMAIL", code: "123456" }, NOW)).toMatchObject({
      ok: false,
      status: 404,
      code: "REGISTRATION_NOT_FOUND",
    });
  });

  it("enforces registration-wide cooldown across EMAIL and SMS and invalidates the previous OTP", () => {
    const pending = pendingRegistration();
    const email = valueOf(sendVerificationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "EMAIL" },
      NOW,
    ));
    expect(email.debugCode).toMatch(/^\d{6}$/);

    expect(sendVerificationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "SMS" },
      NOW + 1_000,
    )).toMatchObject({
      ok: false,
      status: 429,
      code: "RESEND_TOO_SOON",
      retryAfterSeconds: VERIFICATION_RESEND_SECONDS - 1,
    });

    const sms = valueOf(sendVerificationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "SMS" },
      NOW + VERIFICATION_RESEND_SECONDS * 1000 + 1,
    ));
    expect(sms.channel).toBe("SMS");
    expect(verifyRegistrationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "EMAIL", code: email.debugCode ?? "" },
      NOW + VERIFICATION_RESEND_SECONDS * 1000 + 2,
    )).toMatchObject({ ok: false, code: "VERIFICATION_CODE_INVALID" });
  });

  it("creates a DEVELOPER account with profile and consent only after correct OTP", () => {
    const pending = pendingRegistration("new.user");
    expect(authenticateAccount("new.user", "Secure#123")).toBeNull();
    const challenge = valueOf(sendVerificationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "EMAIL" },
      NOW,
    ));
    const completed = valueOf(verifyRegistrationCode(
      pending.registrationId,
      {
        registrationId: pending.registrationId,
        channel: "EMAIL",
        code: challenge.debugCode ?? "",
      },
      NOW + 2_000,
    ));

    expect(completed.user).toMatchObject({ username: "new.user", role: "DEVELOPER" });
    expect(JSON.stringify(completed)).not.toMatch(/password|hash|salt/i);
    expect(authenticateAccount("NEW.USER", "Secure#123")?.user.role).toBe("DEVELOPER");
    expect(findAccountDetailsByUsername("new.user")).toEqual({
      user: completed.user,
      profile: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "+573001234567",
        birthDate: "1990-12-10",
        marketingOptIn: true,
      },
      consent: {
        termsAcceptedAt: new Date(NOW + 2_000).toISOString(),
        termsVersion: "1.0",
        privacyPolicyVersion: "1.0",
      },
    });
    expect(getRegistrationStatus(pending.registrationId, NOW + 3_000)).toEqual({ ok: true, data: { stage: "DETAILS" } });
  });

  it("expires pending registrations and OTP challenges and limits invalid attempts", () => {
    const stale = pendingRegistration("stale.user");
    expect(getRegistrationStatus(
      stale.registrationId,
      NOW + PENDING_REGISTRATION_TTL_SECONDS * 1000 + 1,
    )).toEqual({ ok: true, data: { stage: "DETAILS" } });

    const expired = pendingRegistration("expired.user");
    const challenge = valueOf(sendVerificationCode(
      expired.registrationId,
      { registrationId: expired.registrationId, channel: "EMAIL" },
      NOW,
    ));
    expect(verifyRegistrationCode(
      expired.registrationId,
      { registrationId: expired.registrationId, channel: "EMAIL", code: challenge.debugCode ?? "" },
      NOW + VERIFICATION_CODE_TTL_SECONDS * 1000 + 1,
    )).toMatchObject({ ok: false, code: "VERIFICATION_CODE_EXPIRED" });

    const limited = pendingRegistration("limited.user");
    valueOf(sendVerificationCode(
      limited.registrationId,
      { registrationId: limited.registrationId, channel: "SMS" },
      NOW,
    ));
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(verifyRegistrationCode(
        limited.registrationId,
        { registrationId: limited.registrationId, channel: "SMS", code: "999999" },
        NOW + attempt,
      )).toMatchObject({ ok: false, code: "VERIFICATION_CODE_INVALID" });
    }
    expect(verifyRegistrationCode(
      limited.registrationId,
      { registrationId: limited.registrationId, channel: "SMS", code: "999999" },
      NOW + 5,
    )).toMatchObject({ ok: false, code: "VERIFICATION_ATTEMPTS_EXCEEDED" });
  });

  it("cancels pending registration and any OTP challenge idempotently", () => {
    const pending = pendingRegistration("cancelled.user");
    valueOf(sendVerificationCode(
      pending.registrationId,
      { registrationId: pending.registrationId, channel: "EMAIL" },
      NOW,
    ));
    expect(cancelRegistration(pending.registrationId)).toEqual({ ok: true, data: undefined });
    expect(getRegistrationStatus(pending.registrationId, NOW)).toEqual({ ok: true, data: { stage: "DETAILS" } });
    expect(cancelRegistration("missing")).toEqual({ ok: true, data: undefined });
  });
});
