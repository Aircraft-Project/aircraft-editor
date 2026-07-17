/**
 * Espejo en TS de src/styles/tokens.css, para lugares donde se necesita
 * el valor en JS (colores de ícono, mapas por tipo de componente, etc).
 * Mantener sincronizado con la galería de diseño si los tokens cambian.
 */
export const designTokens = {
  bgCanvas: "#0D1117",
  bgSurface: "#161B22",
  bgSurfaceRaised: "#1C2333",
  bgSurfaceSunken: "#010409",
  borderSubtle: "#21262D",
  borderDefault: "#30363D",
  borderStrong: "#3D444D",

  textPrimary: "#E6EDF3",
  textSecondary: "#8B949E",
  textTertiary: "#6E7681",
  textDisabled: "#4B535D",

  nodeBody: "#E6EDF3",
  nodeColumn: "#3B82F6",
  nodeRow: "#22C55E",

  stateSelected: "#FBBF24",
  stateTriggerDot: "#F97316",
  accentPrimary: "#3B82F6",
  accentPrimaryHover: "#5B9DF7",
  danger: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
} as const;

/** Los 7 tipos de componente publicados por el SchemaProvider (PRD §4.4 / §7.1). */
export type ComponentType =
  | "Button"
  | "Catalog"
  | "Fractal"
  | "ICON"
  | "IMAGE"
  | "TextField"
  | "TextLabel";

export const componentTypeColors: Record<ComponentType, string> = {
  Button: "#F43F5E",
  Catalog: "#8B5CF6",
  Fractal: "#D946EF",
  ICON: "#2DD4BF",
  IMAGE: "#22D3EE",
  TextField: "#A3E635",
  TextLabel: "#A8A29E",
};
