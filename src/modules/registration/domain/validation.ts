import type {
  RegistrationErrors,
  RegistrationFormData,
} from "./registration";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const PASSWORD_LETTER = /[\p{L}]/u;
const PASSWORD_NUMBER = /\d/;
const PASSWORD_SYMBOL = /[^\p{L}\d\s]/u;

export function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s().-]/g, "");
}

export function normalizeRegistrationData(
  data: RegistrationFormData,
): RegistrationFormData {
  return {
    ...data,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLocaleLowerCase(),
    phone: normalizePhone(data.phone),
    username: normalizeUsername(data.username),
  };
}

function isValidBirthDate(
  value: string,
  now: Date,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== value) return false;

  const today = now.toISOString().slice(0, 10);
  return value <= today;
}

export function validateUsername(
  username: string,
): string | undefined {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return "El nombre de usuario es obligatorio.";
  }

  if (normalized.length < 4 || normalized.length > 32) {
    return "El nombre de usuario debe tener entre 4 y 32 caracteres.";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Usa solamente letras, números, punto, guion o guion bajo.";
  }

  return undefined;
}

export function validateRegistration(
  rawData: RegistrationFormData,
  now = new Date(),
): RegistrationErrors {
  const data = normalizeRegistrationData(rawData);
  const errors: RegistrationErrors = {};

  if (!data.firstName) {
    errors.firstName = "El nombre es obligatorio.";
  } else if (
    data.firstName.length < 2 ||
    data.firstName.length > 60
  ) {
    errors.firstName =
      "El nombre debe tener entre 2 y 60 caracteres.";
  }

  if (!data.lastName) {
    errors.lastName = "El apellido es obligatorio.";
  } else if (
    data.lastName.length < 2 ||
    data.lastName.length > 60
  ) {
    errors.lastName =
      "El apellido debe tener entre 2 y 60 caracteres.";
  }

  if (!data.email) {
    errors.email = "El correo electrónico es obligatorio.";
  } else if (
    data.email.length > 254 ||
    !EMAIL_PATTERN.test(data.email)
  ) {
    errors.email = "Ingresa un correo electrónico válido.";
  }

  if (!data.phone) {
    errors.phone = "El número telefónico es obligatorio.";
  } else if (!PHONE_PATTERN.test(data.phone)) {
    errors.phone = "Ingresa un número telefónico válido.";
  }

  if (!data.birthDate) {
    errors.birthDate = "La fecha de nacimiento es obligatoria.";
  } else if (!isValidBirthDate(data.birthDate, now)) {
    errors.birthDate =
      "Ingresa una fecha de nacimiento válida.";
  }

  const usernameError = validateUsername(data.username);
  if (usernameError) errors.username = usernameError;

  if (!data.password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (
    data.password.length < 8 ||
    data.password.length > 128 ||
    !PASSWORD_LETTER.test(data.password) ||
    !PASSWORD_NUMBER.test(data.password) ||
    !PASSWORD_SYMBOL.test(data.password)
  ) {
    errors.password =
      "La contraseña debe tener entre 8 y 128 caracteres e incluir letras, números y un símbolo.";
  }

  if (!data.confirmPassword) {
    errors.confirmPassword =
      "Debes confirmar la contraseña.";
  } else if (data.confirmPassword !== data.password) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  if (!data.termsAccepted) {
    errors.termsAccepted =
      "Debes aceptar los Términos y Condiciones y la Política de Privacidad.";
  }

  return errors;
}

export function hasRegistrationErrors(
  errors: RegistrationErrors,
): boolean {
  return Object.values(errors).some(Boolean);
}

export function isVerificationChannel(
  value: unknown,
): value is "EMAIL" | "SMS" {
  return value === "EMAIL" || value === "SMS";
}

export function isVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return visible + "***@" + domain;
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  const prefixLength = normalized.startsWith("+") ? 3 : 2;
  const prefix = normalized.slice(0, prefixLength);
  const ending = normalized.slice(-4);
  const middle = normalized.slice(prefixLength, -4);
  const visibleMiddle = middle.slice(0, 3);

  return [prefix, visibleMiddle, "***", ending]
    .filter(Boolean)
    .join(" ");
}
