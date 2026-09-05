import { LOGIN_USERNAME_MAX_LENGTH } from "@/modules/auth/types";
import { normalizeLoginCredentials, validateLogin } from "./loginValidation";

describe("login validation", () => {
  it("requires a username after trimming surrounding spaces", () => {
    expect(validateLogin({ username: "   ", password: "admin" })).toEqual({
      username: "El usuario es obligatorio.",
    });
  });

  it("requires a password", () => {
    expect(validateLogin({ username: "admin", password: "" })).toEqual({
      password: "La contraseña es obligatoria.",
    });
  });

  it("limits the username to a reasonable length", () => {
    expect(
      validateLogin({
        username: "a".repeat(LOGIN_USERNAME_MAX_LENGTH + 1),
        password: "admin",
      }),
    ).toEqual({
      username: `El usuario no puede superar ${LOGIN_USERNAME_MAX_LENGTH} caracteres.`,
    });
  });

  it("accepts a valid form and normalizes only the username", () => {
    const credentials = normalizeLoginCredentials({
      username: "  admin  ",
      password: " admin ",
    });

    expect(credentials).toEqual({ username: "admin", password: " admin " });
    expect(validateLogin({ username: "admin", password: "admin" })).toEqual({});
  });
});
