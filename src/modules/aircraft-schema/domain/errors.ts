export type SchemaDefinitionKind = "component" | "trigger" | "context";

export class SchemaDefinitionNotFoundError extends Error {
  readonly code = "SCHEMA_DEFINITION_NOT_FOUND";

  constructor(
    readonly definitionKind: SchemaDefinitionKind,
    readonly definitionType: string,
  ) {
    super("Aircraft schema " + definitionKind + ' "' + definitionType + '" was not found.');
    this.name = "SchemaDefinitionNotFoundError";
  }
}

export class InvalidSchemaSnapshotError extends Error {
  readonly code = "INVALID_SCHEMA_SNAPSHOT";

  constructor(message: string) {
    super(message);
    this.name = "InvalidSchemaSnapshotError";
  }
}
