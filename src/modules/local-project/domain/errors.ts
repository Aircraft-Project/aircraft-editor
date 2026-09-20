export class InvalidLocalProjectIdentifierError extends Error {
  constructor(readonly identifier: string) {
    super("The local project identifier is invalid.");
    this.name = "InvalidLocalProjectIdentifierError";
  }
}

export class LocalProjectNotFoundError extends Error {
  constructor(readonly projectId: string) {
    super("The local project was not found.");
    this.name = "LocalProjectNotFoundError";
  }
}

export class LocalProjectCorruptedError extends Error {
  constructor(readonly documentType?: string, options?: ErrorOptions) {
    super("The local project document is corrupted.", options);
    this.name = "LocalProjectCorruptedError";
  }
}

export class UnsupportedProjectVersionError extends Error {
  constructor(readonly version: number) {
    super("Project format version " + version + " is not supported.");
    this.name = "UnsupportedProjectVersionError";
  }
}

export class ProjectDecryptionError extends Error {
  constructor(options?: ErrorOptions) {
    super("The local project document could not be decrypted.", options);
    this.name = "ProjectDecryptionError";
  }
}

export class LocalStorageUnavailableError extends Error {
  constructor() {
    super("Encrypted local project storage is not available.");
    this.name = "LocalStorageUnavailableError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(readonly resourceId: string) {
    super("The local project resource was not found.");
    this.name = "ResourceNotFoundError";
  }
}
