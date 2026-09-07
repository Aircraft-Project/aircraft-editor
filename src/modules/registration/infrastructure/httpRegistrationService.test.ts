/** @jest-environment node */

import { RegistrationServiceError } from "../application";
import { EMPTY_REGISTRATION_FORM } from "../domain";
import { HttpRegistrationService } from "./httpRegistrationService";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const form = {
  ...EMPTY_REGISTRATION_FORM,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+573001234567",
  birthDate: "1990-12-10",
  username: "ada.dev",
  password: "Secure#123",
  confirmPassword: "Secure#123",
  termsAccepted: true,
};

const contacts = { emailMasked: "ad***@example.com", phoneMasked: "+57 300 *** 4567" };

describe("HttpRegistrationService", () => {
  it("calls the public and protected registration endpoints and validates responses", async () => {
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/check-username")) return jsonResponse({ success: true, data: { username: "ada.dev", available: true } });
      if (path.endsWith("/start")) return jsonResponse({ success: true, data: { registrationId: "reg-1", status: "PENDING_VERIFICATION", contacts } }, 201);
      if (path.endsWith("/status")) return jsonResponse({ success: true, data: { stage: "VERIFICATION", registrationId: "reg-1", contacts, selectedChannel: undefined, resendAvailableInSeconds: 0, codeExpiresInSeconds: 0 } });
      if (path.endsWith("/send-code")) return jsonResponse({ success: true, data: { channel: "EMAIL", maskedDestination: contacts.emailMasked, expiresInSeconds: 300, resendAvailableInSeconds: 60, debugCode: "123456" } });
      if (path.endsWith("/verify")) return jsonResponse({ success: true, data: { user: { id: "usr-1", username: "ada.dev", displayName: "Ada Lovelace", initials: "AL", role: "DEVELOPER" } } });
      return jsonResponse({ success: true });
    });
    const service = new HttpRegistrationService(fetcher as unknown as typeof fetch);

    await expect(service.checkUsername("ada.dev")).resolves.toEqual({ username: "ada.dev", available: true });
    await expect(service.startRegistration(form)).resolves.toMatchObject({ registrationId: "reg-1" });
    await expect(service.getStatus()).resolves.toMatchObject({ stage: "VERIFICATION" });
    await expect(service.sendVerificationCode({ registrationId: "reg-1", channel: "EMAIL" })).resolves.toMatchObject({ debugCode: "123456" });
    await expect(service.verifyCode({ registrationId: "reg-1", channel: "EMAIL", code: "123456" })).resolves.toMatchObject({ user: { role: "DEVELOPER" } });
    await expect(service.cancel()).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/register/start",
      expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify(form) }),
    );
    expect(fetcher).not.toHaveBeenCalledWith(expect.stringContaining("/access"), expect.anything());
  });

  it("preserves typed API errors, field errors, and retry metadata", async () => {
    const fetcher = jest.fn(async () => jsonResponse({
      success: false,
      code: "RESEND_TOO_SOON",
      message: "Espera antes de solicitar un nuevo código.",
      retryAfterSeconds: 42,
      errors: { username: "No disponible" },
    }, 429));
    const service = new HttpRegistrationService(fetcher as unknown as typeof fetch);

    await expect(service.sendVerificationCode({ registrationId: "reg-1", channel: "EMAIL" })).rejects.toMatchObject({
      name: "RegistrationServiceError",
      code: "RESEND_TOO_SOON",
      status: 429,
      retryAfterSeconds: 42,
      errors: { username: "No disponible" },
    } satisfies Partial<RegistrationServiceError>);
  });

  it("maps connection failures to a safe network error", async () => {
    const fetcher = jest.fn(async () => { throw new TypeError("offline secret"); });
    const service = new HttpRegistrationService(fetcher as unknown as typeof fetch);
    await expect(service.checkUsername("ada.dev")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "No fue posible conectar con el servidor.",
    });
  });

  it.each([
    [jsonResponse({ success: true }, 200), 200],
    [jsonResponse({ success: false, message: "missing code" }, 500), 500],
    [new Response("not json", { status: 200 }), 200],
  ])("rejects malformed responses", async (response, status) => {
    const service = new HttpRegistrationService(jest.fn(async () => response) as unknown as typeof fetch);
    await expect(service.getStatus()).rejects.toMatchObject({ code: "INVALID_RESPONSE", status });
  });
});

