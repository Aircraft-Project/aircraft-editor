import type { SchemaProvider } from "../application";
import { MockSchemaProvider } from "../infrastructure";

/**
 * Single renderer-side composition point. A future Electron provider can
 * replace this binding without changing Editor workspaces.
 */
export const aircraftSchemaProvider: SchemaProvider =
  new MockSchemaProvider();
