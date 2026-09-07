jest.mock("server-only", () => ({}));

import {
  authenticateAccount,
  createDeveloperAccount,
  findAccountDetailsByUsername,
  findAccountSessionById,
  hashPassword,
  isAccountUsernameAvailable,
  resetMockAccountsForTests,
  verifyPassword,
} from "./accountStore";

const profile = {
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@example.com",
  phone: "+573001112233",
  birthDate: "1906-12-09",
  marketingOptIn: true,
};

const consent = {
  termsAcceptedAt: "2026-04-01T12:00:00.000Z",
  termsVersion: "1.0",
  privacyPolicyVersion: "1.0",
};

describe("account store", () => {
  beforeEach(resetMockAccountsForTests);

  it("authenticates seeded accounts without exposing credentials", () => {
    expect(authenticateAccount(" ADMIN ", "admin")?.user.role).toBe("ADMIN");
    expect(authenticateAccount("developer", "developer")?.user.role).toBe("DEVELOPER");
    expect(authenticateAccount("admin", "wrong")).toBeNull();
    expect(authenticateAccount("unknown", "admin")).toBeNull();
  });

  it("creates only DEVELOPER accounts with profile, consent and hashed passwords", () => {
    const salt = "test-salt";
    const passwordHash = hashPassword("Secure#123", salt);
    expect(passwordHash).not.toContain("Secure#123");
    expect(verifyPassword("Secure#123", passwordHash, salt)).toBe(true);
    expect(verifyPassword("wrong", passwordHash, salt)).toBe(false);

    const user = createDeveloperAccount({
      id: "usr-new",
      username: " New.User ",
      passwordHash,
      passwordSalt: salt,
      profile,
      consent,
    });
    expect(user).toMatchObject({ username: "new.user", displayName: "Grace Hopper", initials: "GH", role: "DEVELOPER" });
    expect(authenticateAccount("NEW.USER", "Secure#123")?.user).toEqual(user);
    expect(findAccountSessionById(" usr-new ")?.user).toEqual(user);
    expect(findAccountSessionById("missing")).toBeNull();
    expect(isAccountUsernameAvailable("new.user")).toBe(false);

    const details = findAccountDetailsByUsername("NEW.USER");
    expect(details).toEqual({ user, profile, consent });
    expect(JSON.stringify(details)).not.toContain("passwordHash");
    expect(JSON.stringify(details)).not.toContain("passwordSalt");

    expect(() => createDeveloperAccount({
      id: "duplicate",
      username: "NEW.USER",
      passwordHash,
      passwordSalt: salt,
      profile,
      consent,
    })).toThrow("USERNAME_ALREADY_EXISTS");
  });
});
