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

/**
 * Component identifiers are schema data, not a closed Editor enum.
 * Presentation colors are optional decoration with a deterministic fallback.
 */
export type ComponentType = string;

const componentTypeColors: Readonly<Record<string, string>> = {
  Button: "#F43F5E",
  Catalog: "#8B5CF6",
  Fractal: "#D946EF",
  ICON: "#2DD4BF",
  IMAGE: "#22D3EE",
  TextField: "#A3E635",
  TextLabel: "#A8A29E",
};

const fallbackColors = [
  "#38BDF8",
  "#22D3EE",
  "#2DD4BF",
  "#818CF8",
] as const;

export function getComponentTypeColor(type: string): string {
  const hash = [...type].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return componentTypeColors[type] ?? fallbackColors[hash % fallbackColors.length];
}
