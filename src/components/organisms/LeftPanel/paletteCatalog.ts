import { ComponentType } from "@/design/tokens";

/**
 * Catálogo estático de demostración. En la app real esto viene de
 * SchemaProvider.listComponentTypes() / getComponentSchema(type).subtypes
 * (PRD §7.1) — no hay enum fijo en el código del IDE.
 */
export type PaletteItem = { type: ComponentType; subtype: string };

export const quickItems: PaletteItem[] = [
  { type: "Button", subtype: "Simple" },
  { type: "TextLabel", subtype: "Label" },
  { type: "IMAGE", subtype: "Basic" },
  { type: "TextField", subtype: "Basic" },
];

export const paletteByType: Record<ComponentType, string[]> = {
  Button: ["Simple"],
  Catalog: ["Dynamic"],
  Fractal: ["Standard"],
  ICON: ["Basic"],
  IMAGE: ["Basic"],
  TextField: ["Basic", "Email", "Password", "Numeric", "Currency", "DatePicker", "Dropdown", "DynamicDropdown"],
  TextLabel: ["Label"],
};
