import type { SchemaProvider } from "../application";
import {
  SchemaDefinitionNotFoundError,
  type ComponentDefinition,
  type ComponentSchema,
  type ContextRules,
  type EventDefinition,
  type SchemaManifest,
  type TriggerDefinition,
  type TriggerSchema,
} from "../domain";
import { snapshotV1 } from "./snapshot/v1";
import {
  parseSchemaSnapshot,
  type ParsedSchemaSnapshot,
} from "./validation/parseSchemaSnapshot";

function toComponentDefinition(
  schema: ComponentSchema,
): ComponentDefinition {
  return {
    type: schema.type,
    ...(schema.description ? { description: schema.description } : {}),
    subtypes: schema.subtypes,
    contexts: schema.contexts,
  };
}

function toTriggerDefinition(schema: TriggerSchema): TriggerDefinition {
  return {
    type: schema.type,
    ...(schema.description ? { description: schema.description } : {}),
  };
}

export class MockSchemaProvider implements SchemaProvider {
  private readonly snapshot: ParsedSchemaSnapshot;
  private readonly componentsByType: ReadonlyMap<string, ComponentSchema>;
  private readonly triggersByType: ReadonlyMap<string, TriggerSchema>;
  private readonly contextsByName: ReadonlyMap<string, ContextRules>;

  constructor(source: unknown = snapshotV1) {
    this.snapshot = parseSchemaSnapshot(source);
    this.componentsByType = new Map(
      this.snapshot.components.map((component) => [
        component.type,
        component,
      ]),
    );
    this.triggersByType = new Map(
      this.snapshot.triggers.map((trigger) => [trigger.type, trigger]),
    );
    this.contextsByName = new Map(
      this.snapshot.contexts.map((context) => [context.context, context]),
    );
  }

  getManifest(): Promise<SchemaManifest> {
    return Promise.resolve(this.snapshot.manifest);
  }

  listComponents(): Promise<readonly ComponentDefinition[]> {
    return Promise.resolve(
      this.snapshot.components.map(toComponentDefinition),
    );
  }

  getComponent(type: string): Promise<ComponentSchema> {
    const schema = this.componentsByType.get(type);
    if (!schema) {
      return Promise.reject(
        new SchemaDefinitionNotFoundError("component", type),
      );
    }

    return Promise.resolve(schema);
  }

  listTriggers(): Promise<readonly TriggerDefinition[]> {
    return Promise.resolve(this.snapshot.triggers.map(toTriggerDefinition));
  }

  getTrigger(type: string): Promise<TriggerSchema> {
    const schema = this.triggersByType.get(type);
    if (!schema) {
      return Promise.reject(
        new SchemaDefinitionNotFoundError("trigger", type),
      );
    }

    return Promise.resolve(schema);
  }

  async getEffectiveEvents(
    componentType: string,
  ): Promise<readonly EventDefinition[]> {
    return (await this.getComponent(componentType)).effectiveEvents;
  }

  listContexts(): Promise<readonly ContextRules[]> {
    return Promise.resolve(this.snapshot.contexts);
  }

  getContextRules(context: string): Promise<ContextRules> {
    const rules = this.contextsByName.get(context);
    if (!rules) {
      return Promise.reject(
        new SchemaDefinitionNotFoundError("context", context),
      );
    }

    return Promise.resolve(rules);
  }
}
