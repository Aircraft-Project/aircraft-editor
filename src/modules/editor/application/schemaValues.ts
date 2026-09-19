import type {
  PropertySchema,
  SchemaValue,
} from "@/modules/aircraft-schema";

export function createDefaultValues(
  properties: readonly PropertySchema[],
): Record<string, SchemaValue> {
  return Object.fromEntries(
    properties.map((property) => [
      property.name,
      property.defaultValue ?? defaultValueFor(property),
    ]),
  );
}

function defaultValueFor(property: PropertySchema): SchemaValue {
  if (property.options?.length) {
    return property.options[0];
  }

  switch (property.valueType.kind) {
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "array":
      return [];
    case "object":
    case "map":
      return {};
    default:
      return "";
  }
}

export function isPropertyApplicable(
  property: PropertySchema,
  subtype: string,
): boolean {
  return (
    !property.applicableSubtypes?.length ||
    property.applicableSubtypes.includes(subtype)
  );
}

export function displaySchemaValue(value: SchemaValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
