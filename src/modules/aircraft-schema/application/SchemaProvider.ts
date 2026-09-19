import type {
  ComponentDefinition,
  ComponentSchema,
  ContextRules,
  EventDefinition,
  SchemaManifest,
  TriggerDefinition,
  TriggerSchema,
} from "../domain";

export interface SchemaProvider {
  getManifest(): Promise<SchemaManifest>;
  listComponents(): Promise<readonly ComponentDefinition[]>;
  getComponent(type: string): Promise<ComponentSchema>;
  listTriggers(): Promise<readonly TriggerDefinition[]>;
  getTrigger(type: string): Promise<TriggerSchema>;
  getEffectiveEvents(
    componentType: string,
  ): Promise<readonly EventDefinition[]>;
  listContexts(): Promise<readonly ContextRules[]>;
  getContextRules(context: string): Promise<ContextRules>;
}
