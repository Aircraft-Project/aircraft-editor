import type { SafeStorage } from "electron";

export type ProtectedMasterKeyErrorCode =
  | "ENCRYPTION_UNAVAILABLE"
  | "INVALID_MASTER_KEY";

export class ProtectedMasterKeyError extends Error {
  constructor(
    readonly code: ProtectedMasterKeyErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProtectedMasterKeyError";
  }
}

export function decodeProtectedMasterKey(
  protectedKey: Uint8Array,
  safeStorage: SafeStorage,
): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new ProtectedMasterKeyError(
      "ENCRYPTION_UNAVAILABLE",
      "Operating-system key protection is unavailable.",
    );
  }

  let encodedKey: string;
  try {
    encodedKey = safeStorage.decryptString(Buffer.from(protectedKey));
  } catch (error) {
    throw new ProtectedMasterKeyError(
      "INVALID_MASTER_KEY",
      "The protected master key could not be decrypted.",
      { cause: error },
    );
  }

  const masterKey = Buffer.from(encodedKey, "base64");
  if (masterKey.length !== 32) {
    throw new ProtectedMasterKeyError(
      "INVALID_MASTER_KEY",
      "The protected master key has an invalid length.",
    );
  }
  return masterKey;
}
