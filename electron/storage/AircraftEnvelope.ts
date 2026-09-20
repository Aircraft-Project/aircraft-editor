import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

export const AIRCRAFT_MAGIC = Buffer.from("AIRCRFT1", "ascii");
export const ENVELOPE_VERSION = 1;
export const ENCRYPTION_VERSION = 1;
export const PROJECT_FORMAT_VERSION = 1;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX_LENGTH = 14;
const HEADER_LENGTH = PREFIX_LENGTH + NONCE_LENGTH;

export const DOCUMENT_TYPES = {
  PROJECT: 1,
  METADATA: 2,
  SCREEN: 3,
  LAYOUT: 4,
  TRIGGER_GRAPH: 5,
  RESOURCE_MANIFEST: 6,
  SETTINGS: 7,
  RESOURCE_BLOB: 8,
} as const;

export type AircraftDocumentType =
  (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const PAYLOAD_ENCODINGS = {
  MESSAGE_PACK: 1,
  RAW_BYTES: 2,
} as const;

export class UnsupportedProjectVersionError extends Error {
  constructor(readonly version: number) {
    super("Project format version " + version + " is not supported.");
    this.name = "UnsupportedProjectVersionError";
  }
}

export class UnsupportedDocumentVersionError extends Error {
  constructor(readonly version: unknown) {
    super(
      "Aircraft document version " + String(version) + " is not supported.",
    );
    this.name = "UnsupportedDocumentVersionError";
  }
}

export class ProjectDecryptionError extends Error {
  constructor(options?: ErrorOptions) {
    super("The local project document could not be decrypted.", options);
    this.name = "ProjectDecryptionError";
  }
}

export function encryptEnvelope(
  type: AircraftDocumentType,
  plaintext: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  const prefix = Buffer.alloc(PREFIX_LENGTH);
  AIRCRAFT_MAGIC.copy(prefix, 0);
  prefix.writeUInt8(ENVELOPE_VERSION, 8);
  prefix.writeUInt8(type, 9);
  prefix.writeUInt16BE(PROJECT_FORMAT_VERSION, 10);
  prefix.writeUInt8(ENCRYPTION_VERSION, 12);
  prefix.writeUInt8(expectedEncoding(type), 13);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(prefix);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  return Buffer.concat([
    prefix,
    nonce,
    ciphertext,
    cipher.getAuthTag(),
  ]);
}

export function decryptEnvelope(
  expectedType: AircraftDocumentType,
  envelope: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  const bytes = Buffer.from(envelope);
  if (
    bytes.length < HEADER_LENGTH + AUTH_TAG_LENGTH ||
    !bytes.subarray(0, AIRCRAFT_MAGIC.length).equals(AIRCRAFT_MAGIC)
  ) {
    throw new ProjectDecryptionError();
  }
  const version = bytes.readUInt16BE(10);
  if (version !== PROJECT_FORMAT_VERSION) {
    throw new UnsupportedProjectVersionError(version);
  }
  if (
    bytes.readUInt8(8) !== ENVELOPE_VERSION ||
    bytes.readUInt8(9) !== expectedType ||
    bytes.readUInt8(12) !== ENCRYPTION_VERSION ||
    bytes.readUInt8(13) !== expectedEncoding(expectedType)
  ) {
    throw new ProjectDecryptionError();
  }

  const prefix = bytes.subarray(0, PREFIX_LENGTH);
  const nonce = bytes.subarray(PREFIX_LENGTH, HEADER_LENGTH);
  const tag = bytes.subarray(bytes.length - AUTH_TAG_LENGTH);
  const ciphertext = bytes.subarray(
    HEADER_LENGTH,
    bytes.length - AUTH_TAG_LENGTH,
  );
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(prefix);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  } catch (error) {
    throw new ProjectDecryptionError({ cause: error });
  }
}

function expectedEncoding(type: AircraftDocumentType): number {
  return type === DOCUMENT_TYPES.RESOURCE_BLOB
    ? PAYLOAD_ENCODINGS.RAW_BYTES
    : PAYLOAD_ENCODINGS.MESSAGE_PACK;
}
