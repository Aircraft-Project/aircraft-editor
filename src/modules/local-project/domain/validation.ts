import { InvalidLocalProjectIdentifierError } from "./errors";

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertSafeIdentifier(value: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new InvalidLocalProjectIdentifierError(value);
  }
}

export function assertOwnerId(ownerId: string): void {
  if (!ownerId.trim() || ownerId.length > 256 || /[\0\r\n]/.test(ownerId)) {
    throw new InvalidLocalProjectIdentifierError(ownerId);
  }
}
