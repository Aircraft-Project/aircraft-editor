/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { findAccountDetailsByUsername, resetMockAccountsForTests } from "@/modules/accounts/server";
import { resetRegistrationStateForTests } from "@/modules/registration/server";
import { POST as login } from "../login/route";
import { POST as cancel } from "./cancel/route";
import { POST as checkUsername } from "./check-username/route";
import { POST as sendCode } from "./send-code/route";
import { POST as start } from "./start/route";
import { GET as status } from "./status/route";
import { POST as verify } from "./verify/route";

const form = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ADA@example.com",
  phone: "+57 300 123 4567",
  birthDate: "1990-12-10",
  username: "ada.dev",
  password: "Secure#123",
  confirmPassword: "Secure#123",
  termsAccepted: true,
  marketingOptIn: true,
};

function request(path: string, cookie = "", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/auth/register/${path}`, {
    method: path === "status" ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("registration API", () => {
  beforeEach(() => {
    resetRegistrationStateForTests();
    resetMockAccountsForTests();
  });

  it("starts publicly, sets only the pending cookie, and completes registration before login", async () => {
    const publicStatus = await status(request("status"));
    expect(publicStatus.status).toBe(200);
    await expect(publicStatus.json()).resolves.toEqual({ success: true, data: { stage: "DETAILS" } });

    const checkResponse = await checkUsername(request("check-username", "", { username: "Ada.Dev" }));
    await expect(checkResponse.json()).resolves.toMatchObject({
      success: true,
      data: { username: "ada.dev", available: true },
    });

    const startResponse = await start(request("start", "", form));
    const startBody = await startResponse.json();
    expect(startResponse.status).toBe(201);
    expect(JSON.stringify(startBody)).not.toMatch(/Secure#123|password|hash|salt/i);
    const registrationId = startBody.data.registrationId as string;
    const setCookie = startResponse.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("aircraft.registration.pending=");
    expect(setCookie).not.toContain("aircraft.registration.flow");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    const cookie = setCookie.split(";")[0];

    const statusResponse = await status(request("status", cookie));
    await expect(statusResponse.json()).resolves.toMatchObject({
      data: {
        stage: "VERIFICATION",
        registrationId,
        resendAvailableInSeconds: 0,
        codeExpiresInSeconds: 0,
      },
    });

    const codeResponse = await sendCode(request("send-code", cookie, { registrationId, channel: "EMAIL" }));
    const codeBody = await codeResponse.json();
    expect(codeBody.data.debugCode).toMatch(/^\d{6}$/);

    const verifyResponse = await verify(request("verify", cookie, {
      registrationId,
      channel: "EMAIL",
      code: codeBody.data.debugCode,
    }));
    expect(verifyResponse.status).toBe(200);
    expect((verifyResponse.headers.get("set-cookie") ?? "").toLowerCase()).toContain("max-age=0");
    await expect(verifyResponse.json()).resolves.toMatchObject({
      data: { user: { username: "ada.dev", role: "DEVELOPER" } },
    });

    expect(findAccountDetailsByUsername("ada.dev")).toMatchObject({
      profile: {
        email: "ada@example.com",
        phone: "+573001234567",
        birthDate: "1990-12-10",
        marketingOptIn: true,
      },
      consent: {
        termsAcceptedAt: expect.any(String),
        termsVersion: "1.0",
        privacyPolicyVersion: "1.0",
      },
    });

    const loginResponse = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ada.dev", password: "Secure#123" }),
    }));
    expect(loginResponse.status).toBe(200);
    await expect(loginResponse.json()).resolves.toMatchObject({
      data: { session: { user: { role: "DEVELOPER" } } },
    });
  });

  it("protects Step 2 without gating public status and clears pending state on cancel", async () => {
    const startResponse = await start(request("start", "", { ...form, username: "cancel.me" }));
    const body = await startResponse.json();
    const registrationId = body.data.registrationId as string;
    const cookie = (startResponse.headers.get("set-cookie") ?? "").split(";")[0];

    const missingCookie = await sendCode(request("send-code", "", { registrationId, channel: "SMS" }));
    expect(missingCookie.status).toBe(404);
    await expect(missingCookie.json()).resolves.toMatchObject({ code: "REGISTRATION_NOT_FOUND" });

    const cancelResponse = await cancel(request("cancel", cookie));
    expect(cancelResponse.status).toBe(200);
    expect((cancelResponse.headers.get("set-cookie") ?? "").toLowerCase()).toContain("max-age=0");

    const afterCancel = await status(request("status", cookie));
    expect(afterCancel.status).toBe(200);
    await expect(afterCancel.json()).resolves.toEqual({ success: true, data: { stage: "DETAILS" } });
  });
});
