import {
  EMPTY_REGISTRATION_FORM,
  hasRegistrationErrors,
  isVerificationChannel,
  isVerificationCode,
  maskEmail,
  maskPhone,
  normalizePhone,
  normalizeRegistrationData,
  normalizeUsername,
  validateRegistration,
  validateUsername,
} from "./index";

const validForm = {
  ...EMPTY_REGISTRATION_FORM,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "Ada@Example.com",
  phone: "+57 300 123 4567",
  birthDate: "1990-12-10",
  username: "Ada.Dev",
  password: "Secure#123",
  confirmPassword: "Secure#123",
  termsAccepted: true,
};

describe("registration validation", () => {
  it("normalizes safe fields without trimming passwords", () => {
    const normalized = normalizeRegistrationData({
      ...validForm,
      firstName: " Ada ",
      lastName: " Lovelace ",
      password: " Secure#123 ",
      confirmPassword: " Secure#123 ",
    });
    expect(normalized).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+573001234567",
      username: "ada.dev",
      password: " Secure#123 ",
    });
    expect(normalizeUsername(" ADMIN ")).toBe("admin");
    expect(normalizePhone("(300) 123-45.67")).toBe("3001234567");
  });

  it("accepts a complete valid form", () => {
    const errors = validateRegistration(validForm, new Date("2026-01-01T00:00:00Z"));
    expect(errors).toEqual({});
    expect(hasRegistrationErrors(errors)).toBe(false);
  });

  it("reports every required field", () => {
    const errors = validateRegistration(EMPTY_REGISTRATION_FORM);
    expect(errors).toEqual(expect.objectContaining({
      firstName: expect.any(String),
      lastName: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      birthDate: expect.any(String),
      username: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
      termsAccepted: expect.any(String),
    }));
    expect(hasRegistrationErrors(errors)).toBe(true);
  });

  it.each([
    [{ ...validForm, firstName: "A", lastName: "L" }, ["firstName", "lastName"]],
    [{ ...validForm, email: "invalid", phone: "123" }, ["email", "phone"]],
    [{ ...validForm, birthDate: "2026-02-31" }, ["birthDate"]],
    [{ ...validForm, birthDate: "2027-01-01" }, ["birthDate"]],
    [{ ...validForm, username: "bad user" }, ["username"]],
    [{ ...validForm, password: "onlyletters", confirmPassword: "different" }, ["password", "confirmPassword"]],
  ])("rejects invalid data", (form, fields) => {
    const errors = validateRegistration(form, new Date("2026-06-01T00:00:00Z"));
    fields.forEach((field) => expect(errors[field as keyof typeof errors]).toBeTruthy());
  });

  it("validates username and verification primitives", () => {
    expect(validateUsername("valid.user")).toBeUndefined();
    expect(validateUsername("abc")).toContain("4 y 32");
    expect(isVerificationChannel("EMAIL")).toBe(true);
    expect(isVerificationChannel("SMS")).toBe(true);
    expect(isVerificationChannel("PUSH")).toBe(false);
    expect(isVerificationCode("123456")).toBe(true);
    expect(isVerificationCode("12345a")).toBe(false);
  });

  it("masks destinations without returning their full value", () => {
    expect(maskEmail("user@example.com")).toBe("us***@example.com");
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
    expect(maskPhone("+573001234567")).toContain("*** 4567");
    expect(maskPhone("3001234567")).toContain("*** 4567");
  });
});
