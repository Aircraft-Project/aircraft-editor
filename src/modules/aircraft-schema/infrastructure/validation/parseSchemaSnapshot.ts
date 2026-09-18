import {
  InvalidSchemaSnapshotError,
  type ComponentSchema,
  type ComponentSubtype,
  type ContextRules,
  type PropertySchema,
  type PropertyValueType,
  type PropertyVariant,
  type SchemaManifest,
  type SchemaValue,
  type TriggerSchema,
} from "../../domain";

export interface ParsedSchemaSnapshot {
  readonly manifest: SchemaManifest;
  readonly components: readonly ComponentSchema[];
  readonly triggers: readonly TriggerSchema[];
  readonly contexts: readonly ContextRules[];
}

type JsonRecord = Record<string, unknown>;

function invalid(path: string, message: string): never {
  throw new InvalidSchemaSnapshotError(path + ": " + message);
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid(path, "expected an object.");
  }

  return value as JsonRecord;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return invalid(path, "expected a non-empty string.");
  }

  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, path);
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    return invalid(path, "expected a boolean.");
  }

  return value;
}

function readCount(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    return invalid(path, "expected a non-negative integer.");
  }

  return value as number;
}

function readArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return invalid(path, "expected an array.");
  }

  return value;
}

function readStringArray(value: unknown, path: string): readonly string[] {
  return readArray(value, path).map((item, index) =>
    readString(item, path + "[" + index + "]"),
  );
}

function readOptionalStringArray(
  value: unknown,
  path: string,
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readStringArray(value, path);
}

function isSchemaValue(value: unknown): value is SchemaValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isSchemaValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isSchemaValue);
  }

  return false;
}

function readSchemaValue(value: unknown, path: string): SchemaValue {
  if (!isSchemaValue(value)) {
    return invalid(path, "expected a JSON-compatible value.");
  }

  return value;
}

function readOptionalSchemaValues(
  value: unknown,
  path: string,
): readonly SchemaValue[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readArray(value, path).map((item, index) =>
    readSchemaValue(item, path + "[" + index + "]"),
  );
}

function parseValueType(
  rawValueType: string,
): { valueType: PropertyValueType; inferredOptions?: readonly SchemaValue[] } {
  const normalized = rawValueType.toLowerCase();

  if (normalized.startsWith("enum:")) {
    const inferredOptions = rawValueType
      .slice(rawValueType.indexOf(":") + 1)
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);

    return {
      valueType: { kind: "enum", raw: rawValueType },
      inferredOptions,
    };
  }

  if (normalized === "int" || normalized === "integer") {
    return { valueType: { kind: "integer", raw: rawValueType } };
  }

  if (
    normalized === "string" ||
    normalized === "number" ||
    normalized === "boolean" ||
    normalized === "object" ||
    normalized === "array"
  ) {
    return {
      valueType: {
        kind: normalized,
        raw: rawValueType,
      },
    };
  }

  const listMatch = /^list<(.+)>$/i.exec(rawValueType);
  if (listMatch) {
    return {
      valueType: {
        kind: "array",
        raw: rawValueType,
        itemType: listMatch[1],
      },
    };
  }

  const mapMatch = /^map<(.+)>$/i.exec(rawValueType);
  if (mapMatch) {
    return {
      valueType: {
        kind: "map",
        raw: rawValueType,
        itemType: mapMatch[1],
      },
    };
  }

  return { valueType: { kind: "custom", raw: rawValueType } };
}

function parseVariant(value: unknown, path: string): PropertyVariant {
  const record = readRecord(value, path);

  return {
    discriminatorValue: readString(
      record.discriminatorValue,
      path + ".discriminatorValue",
    ),
    fields: parseProperties(record.fields, path + ".fields"),
  };
}

function parseProperties(value: unknown, path: string): readonly PropertySchema[] {
  if (value === undefined) {
    return [];
  }

  return readArray(value, path).map((property, index) =>
    parseProperty(property, path + "[" + index + "]"),
  );
}

function parseProperty(value: unknown, path: string): PropertySchema {
  const record = readRecord(value, path);
  const rawValueType = readString(record.valueType, path + ".valueType");
  const { valueType, inferredOptions } = parseValueType(rawValueType);
  const explicitOptions = readOptionalSchemaValues(record.enum, path + ".enum");
  const applicableSubtypes = readOptionalStringArray(
    record.applicableSubtypes,
    path + ".applicableSubtypes",
  );
  const fields =
    record.fields === undefined
      ? undefined
      : parseProperties(record.fields, path + ".fields");
  const variants =
    record.variants === undefined
      ? undefined
      : readArray(record.variants, path + ".variants").map((variant, index) =>
          parseVariant(variant, path + ".variants[" + index + "]"),
        );
  const description = readOptionalString(
    record.description,
    path + ".description",
  );
  const discriminatorField = readOptionalString(
    record.discriminatorField,
    path + ".discriminatorField",
  );
  const hasDefault = Object.prototype.hasOwnProperty.call(record, "default");
  const hasExample = Object.prototype.hasOwnProperty.call(record, "example");

  return {
    name: readString(record.name, path + ".name"),
    valueType,
    required: readBoolean(record.required, path + ".required"),
    ...(hasDefault
      ? { defaultValue: readSchemaValue(record.default, path + ".default") }
      : {}),
    ...((explicitOptions ?? inferredOptions)
      ? { options: explicitOptions ?? inferredOptions }
      : {}),
    ...(applicableSubtypes ? { applicableSubtypes } : {}),
    ...(fields ? { fields } : {}),
    ...(discriminatorField ? { discriminatorField } : {}),
    ...(variants ? { variants } : {}),
    ...(description ? { description } : {}),
    ...(hasExample
      ? { example: readSchemaValue(record.example, path + ".example") }
      : {}),
  };
}

function readOptionalStringMap(
  value: unknown,
  path: string,
): Readonly<Record<string, string>> {
  if (value === undefined) {
    return {};
  }

  const record = readRecord(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      readString(item, path + "." + key),
    ]),
  );
}

function parseComponent(value: unknown, path: string): ComponentSchema {
  const record = readRecord(value, path);
  const subtypeNames = readStringArray(record.subtypes, path + ".subtypes");
  const subtypeDescriptions = readOptionalStringMap(
    record.subtypeDescriptions,
    path + ".subtypeDescriptions",
  );
  const subtypes: readonly ComponentSubtype[] = subtypeNames.map((type) => ({
    type,
    ...(subtypeDescriptions[type]
      ? { description: subtypeDescriptions[type] }
      : {}),
  }));
  const description = readOptionalString(
    record.description,
    path + ".description",
  );

  return {
    type: readString(record.type, path + ".type"),
    ...(description ? { description } : {}),
    subtypes,
    contexts: readStringArray(record.contexts, path + ".contexts"),
    effectiveEvents: readStringArray(
      record.effectiveEvents,
      path + ".effectiveEvents",
    ).map((type) => ({ type })),
    properties: parseProperties(record.properties, path + ".properties"),
  };
}

function parseTrigger(value: unknown, path: string): TriggerSchema {
  const record = readRecord(value, path);
  const description = readOptionalString(
    record.description,
    path + ".description",
  );

  return {
    type: readString(record.type, path + ".type"),
    ...(description ? { description } : {}),
    requiredProperties: parseProperties(
      record.requiredProperties,
      path + ".requiredProperties",
    ),
    optionalProperties: parseProperties(
      record.optionalProperties,
      path + ".optionalProperties",
    ),
  };
}

function parseContext(value: unknown, path: string): ContextRules {
  const record = readRecord(value, path);

  return {
    context: readString(record.context, path + ".context"),
    allowedComponentTypes: readStringArray(
      record.allowedComponentTypes,
      path + ".allowedComponentTypes",
    ),
    supportsTriggers: readBoolean(
      record.supportsTriggers,
      path + ".supportsTriggers",
    ),
    supportsObservers: readBoolean(
      record.supportsObservers,
      path + ".supportsObservers",
    ),
  };
}

function parseManifest(value: unknown): SchemaManifest {
  const record = readRecord(value, "manifest");
  const sourceRevision = readOptionalString(
    record.sourceRevision,
    "manifest.sourceRevision",
  );

  return {
    schemaVersion: readString(record.schemaVersion, "manifest.schemaVersion"),
    source: readString(record.source, "manifest.source"),
    ...(sourceRevision ? { sourceRevision } : {}),
    components: readCount(record.components, "manifest.components"),
    triggers: readCount(record.triggers, "manifest.triggers"),
  };
}

function assertUnique(values: readonly string[], path: string): void {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );

  if (duplicates.length > 0) {
    invalid(path, "duplicate values: " + [...new Set(duplicates)].join(", ") + ".");
  }
}

function assertSameTypes(
  indexedTypes: readonly string[],
  actualTypes: readonly string[],
  path: string,
): void {
  const indexed = new Set(indexedTypes);
  const actual = new Set(actualTypes);
  const missing = indexedTypes.filter((type) => !actual.has(type));
  const unindexed = actualTypes.filter((type) => !indexed.has(type));

  if (missing.length > 0 || unindexed.length > 0) {
    invalid(
      path,
      "index mismatch; missing schemas [" +
        missing.join(", ") +
        "], unindexed schemas [" +
        unindexed.join(", ") +
        "].",
    );
  }
}

function validateApplicableSubtypes(
  properties: readonly PropertySchema[],
  subtypes: ReadonlySet<string>,
  path: string,
): void {
  properties.forEach((property, index) => {
    property.applicableSubtypes?.forEach((subtype) => {
      if (!subtypes.has(subtype)) {
        invalid(
          path + "[" + index + "].applicableSubtypes",
          'unknown subtype "' + subtype + '".',
        );
      }
    });

    if (property.fields) {
      validateApplicableSubtypes(
        property.fields,
        subtypes,
        path + "[" + index + "].fields",
      );
    }

    property.variants?.forEach((variant, variantIndex) => {
      validateApplicableSubtypes(
        variant.fields,
        subtypes,
        path + "[" + index + "].variants[" + variantIndex + "].fields",
      );
    });
  });
}

export function parseSchemaSnapshot(value: unknown): ParsedSchemaSnapshot {
  const bundle = readRecord(value, "snapshot");
  const index = readRecord(bundle.index, "index");
  const componentTypes = readStringArray(
    index.componentTypes,
    "index.componentTypes",
  );
  const triggerTypes = readStringArray(index.triggerTypes, "index.triggerTypes");
  const manifest = parseManifest(bundle.manifest);
  const components = readArray(bundle.components, "components").map(
    (component, indexValue) =>
      parseComponent(component, "components[" + indexValue + "]"),
  );
  const triggers = readArray(bundle.triggers, "triggers").map(
    (trigger, indexValue) =>
      parseTrigger(trigger, "triggers[" + indexValue + "]"),
  );
  const contexts = readArray(bundle.contexts, "contexts").map(
    (context, indexValue) =>
      parseContext(context, "contexts[" + indexValue + "]"),
  );

  const actualComponentTypes = components.map((component) => component.type);
  const actualTriggerTypes = triggers.map((trigger) => trigger.type);
  const contextNames = contexts.map((context) => context.context);

  assertUnique(componentTypes, "index.componentTypes");
  assertUnique(triggerTypes, "index.triggerTypes");
  assertUnique(actualComponentTypes, "components");
  assertUnique(actualTriggerTypes, "triggers");
  assertUnique(contextNames, "contexts");
  assertSameTypes(componentTypes, actualComponentTypes, "components");
  assertSameTypes(triggerTypes, actualTriggerTypes, "triggers");

  if (manifest.components !== components.length) {
    invalid(
      "manifest.components",
      "expected " + components.length + ", received " + manifest.components + ".",
    );
  }

  if (manifest.triggers !== triggers.length) {
    invalid(
      "manifest.triggers",
      "expected " + triggers.length + ", received " + manifest.triggers + ".",
    );
  }

  const componentTypeSet = new Set(actualComponentTypes);
  const contextMap = new Map(
    contexts.map((context) => [context.context, context] as const),
  );

  components.forEach((component, componentIndex) => {
    const subtypeNames = component.subtypes.map((subtype) => subtype.type);
    assertUnique(subtypeNames, "components[" + componentIndex + "].subtypes");
    validateApplicableSubtypes(
      component.properties,
      new Set(subtypeNames),
      "components[" + componentIndex + "].properties",
    );

    component.contexts.forEach((context) => {
      const rules = contextMap.get(context);
      if (!rules) {
        invalid(
          "components[" + componentIndex + "].contexts",
          'unknown context "' + context + '".',
        );
      }
      if (!rules.allowedComponentTypes.includes(component.type)) {
        invalid(
          "contexts." + context,
          'component "' + component.type + '" is missing from allowedComponentTypes.',
        );
      }
    });
  });

  contexts.forEach((context, contextIndex) => {
    assertUnique(
      context.allowedComponentTypes,
      "contexts[" + contextIndex + "].allowedComponentTypes",
    );
    context.allowedComponentTypes.forEach((type) => {
      if (!componentTypeSet.has(type)) {
        invalid(
          "contexts[" + contextIndex + "].allowedComponentTypes",
          'unknown component "' + type + '".',
        );
      }

      const component = components.find((candidate) => candidate.type === type);
      if (!component?.contexts.includes(context.context)) {
        invalid(
          "contexts[" + contextIndex + "].allowedComponentTypes",
          'component "' + type + '" does not declare context "' + context.context + '".',
        );
      }
    });
  });

  return {
    manifest,
    components,
    triggers,
    contexts,
  };
}
