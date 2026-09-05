import { LOGIN_USERNAME_MAX_LENGTH, type LoginCredentials, type LoginErrors } from "@/modules/auth/types";

export function normalizeLoginCredentials(credentials: LoginCredentials): LoginCredentials {
  return {
    username: credentials.username.trim(),
    password: credentials.password,
  };
}

export function validateLogin(credentials: LoginCredentials): LoginErrors {
  const errors: LoginErrors = {};
  const username = credentials.username.trim();

  if (!username) {
    errors.username = "El usuario es obligatorio.";
  } else if (username.length > LOGIN_USERNAME_MAX_LENGTH) {
    errors.username = `El usuario no puede superar ${LOGIN_USERNAME_MAX_LENGTH} caracteres.`;
  }

  if (!credentials.password) {
    errors.password = "La contraseña es obligatoria.";
  }

  return errors;
}

export function hasLoginErrors(errors: LoginErrors): boolean {
  return Boolean(errors.username || errors.password);
}
