export type SchemaScalar = string | number | boolean | null;

export type SchemaValue =
  | SchemaScalar
  | readonly SchemaValue[]
  | { readonly [key: string]: SchemaValue };

export type PropertyValueKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "map"
  | "custom";

export interface PropertyValueType {
  readonly kind: PropertyValueKind;
  readonly raw: string;
  readonly itemType?: string;
}

export interface PropertyVariant {
  readonly discriminatorValue: string;
  readonly fields: readonly PropertySchema[];
}

export interface PropertySchema {
  readonly name: string;
  readonly valueType: PropertyValueType;
  readonly required: boolean;
  readonly defaultValue?: SchemaValue;
  readonly options?: readonly SchemaValue[];
  readonly applicableSubtypes?: readonly string[];
  readonly fields?: readonly PropertySchema[];
  readonly discriminatorField?: string;
  readonly variants?: readonly PropertyVariant[];
  readonly description?: string;
  readonly example?: SchemaValue;
}

export interface ComponentSubtype {
  readonly type: string;
  readonly description?: string;
}

export interface EventDefinition {
  readonly type: string;
}

export interface ComponentDefinition {
  readonly type: string;
  readonly description?: string;
  readonly subtypes: readonly ComponentSubtype[];
  readonly contexts: readonly string[];
}

export interface ComponentSchema extends ComponentDefinition {
  readonly properties: readonly PropertySchema[];
  readonly effectiveEvents: readonly EventDefinition[];
}

export interface TriggerDefinition {
  readonly type: string;
  readonly description?: string;
}

export interface TriggerSchema extends TriggerDefinition {
  readonly requiredProperties: readonly PropertySchema[];
  readonly optionalProperties: readonly PropertySchema[];
}

export interface ContextRules {
  readonly context: string;
  readonly allowedComponentTypes: readonly string[];
  readonly supportsTriggers: boolean;
  readonly supportsObservers: boolean;
}

export interface SchemaManifest {
  readonly schemaVersion: string;
  readonly source: string;
  readonly sourceRevision?: string;
  readonly components: number;
  readonly triggers: number;
}
