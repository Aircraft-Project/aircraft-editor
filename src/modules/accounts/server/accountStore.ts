import "server-only";

import { scryptSync, timingSafeEqual } from "node:crypto";

import type { AuthSession, SessionUser, UserRole } from "@/modules/session";

const PASSWORD_KEY_LENGTH = 64;

export type AccountProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  marketingOptIn: boolean;
};

export type AccountConsent = {
  termsAcceptedAt: string;
  termsVersion: string;
  privacyPolicyVersion: string;
};

export type AccountDetails = {
  user: SessionUser;
  profile: AccountProfile;
  consent: AccountConsent;
};

type AccountRecord = SessionUser & {
  passwordHash: string;
  passwordSalt: string;
  profile: AccountProfile;
  consent: AccountConsent;
};

type AccountStoreGlobal = typeof globalThis & {
  __aircraftMockAccounts?: Map<string, AccountRecord>;
};

const DEFAULT_CONSENT: AccountConsent = {
  termsAcceptedAt: "2026-01-01T00:00:00.000Z",
  termsVersion: "1.0",
  privacyPolicyVersion: "1.0",
};

const SEEDED_ACCOUNTS: readonly AccountRecord[] = [
  {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
    passwordSalt: "aircraft-admin-seed-v1",
    passwordHash: "Y4e4bmDp0dpdghsx0/SvgSqLPny4h6hkFcgSnp/DUswA7I9bmSTdY78kJJrdBUUveu3DcnezxsvJIv0WIj8vzg==",
    profile: {
      firstName: "Administrador",
      lastName: "Aircraft",
      email: "admin@aircraft.local",
      phone: "+10000000000",
      birthDate: "1970-01-01",
      marketingOptIn: false,
    },
    consent: DEFAULT_CONSENT,
  },
  {
    id: "usr-developer-001",
    username: "developer",
    displayName: "Desarrollador",
    initials: "DE",
    role: "DEVELOPER",
    passwordSalt: "aircraft-developer-seed-v1",
    passwordHash: "UOv6ZaEo+u/qh088FYIdwm5QYv+EpVlLY/ilMjNBWUNOM5zSbIHRJyvN/wrUgW2QIqFtDtnDkkUSfj+TgYJXvw==",
    profile: {
      firstName: "Desarrollador",
      lastName: "Aircraft",
      email: "developer@aircraft.local",
      phone: "+10000000001",
      birthDate: "1970-01-01",
      marketingOptIn: false,
    },
    consent: DEFAULT_CONSENT,
  },
];

function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase();
}

function createSeededStore(): Map<string, AccountRecord> {
  return new Map(
    SEEDED_ACCOUNTS.map((account) => [
      normalizeUsername(account.username),
      {
        ...account,
        profile: { ...account.profile },
        consent: { ...account.consent },
      },
    ]),
  );
}

function getStore(): Map<string, AccountRecord> {
  const runtime = globalThis as AccountStoreGlobal;
  runtime.__aircraftMockAccounts ??= createSeededStore();
  return runtime.__aircraftMockAccounts;
}

function toSession(record: AccountRecord): AuthSession {
  const { id, username, displayName, initials, role } = record;
  return { user: { id, username, displayName, initials, role } };
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("base64");
}

export function verifyPassword(password: string, passwordHash: string, passwordSalt: string): boolean {
  const expected = Buffer.from(passwordHash, "base64");
  const actual = scryptSync(password, passwordSalt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function authenticateAccount(username: string, password: string): AuthSession | null {
  const account = getStore().get(normalizeUsername(username));
  if (!account || !verifyPassword(password, account.passwordHash, account.passwordSalt)) return null;
  return toSession(account);
}

export function findAccountSessionById(userId: string): AuthSession | null {
  const account = Array.from(getStore().values()).find((candidate) => candidate.id === userId.trim());
  return account ? toSession(account) : null;
}

export function findAccountDetailsByUsername(username: string): AccountDetails | null {
  const account = getStore().get(normalizeUsername(username));
  if (!account) return null;
  return {
    user: toSession(account).user,
    profile: { ...account.profile },
    consent: { ...account.consent },
  };
}

export function isAccountUsernameAvailable(username: string): boolean {
  return !getStore().has(normalizeUsername(username));
}

type CreateDeveloperAccountInput = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  profile: AccountProfile;
  consent: AccountConsent;
};

function createInitials(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((value) => Array.from(value.trim())[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

export function createDeveloperAccount(input: CreateDeveloperAccountInput): SessionUser {
  const username = normalizeUsername(input.username);
  const store = getStore();
  if (store.has(username)) throw new Error("USERNAME_ALREADY_EXISTS");

  const role: UserRole = "DEVELOPER";
  const account: AccountRecord = {
    id: input.id,
    username,
    displayName: [input.profile.firstName.trim(), input.profile.lastName.trim()].filter(Boolean).join(" "),
    initials: createInitials(input.profile.firstName, input.profile.lastName),
    role,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    profile: { ...input.profile },
    consent: { ...input.consent },
  };
  store.set(username, account);
  return toSession(account).user;
}

export function resetMockAccountsForTests(): void {
  const runtime = globalThis as AccountStoreGlobal;
  runtime.__aircraftMockAccounts = createSeededStore();
}
