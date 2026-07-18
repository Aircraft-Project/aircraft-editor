import { ComponentType } from "@/design/tokens";

/**
 * Modelo de AST simplificado (Body → Column → Row → Component), PRD §4.1.
 * Reglas de tamaño (dadas por el usuario, no están en el PRD):
 *  - Column expone el ancho: por defecto se reparte 1/n entre las columnas
 *    hermanas del Body. Se mapea 1:1 a flexbox: cada Column es `flex: 1 1 0%`
 *    dentro de un Body en `flex-direction: row` — flexbox ya reparte el
 *    espacio en partes iguales sin cálculo manual.
 *  - Row expone el alto: por defecto es wrap-content (el tamaño natural de
 *    su contenido). Con `weight`, compite por el espacio vertical sobrante
 *    de forma ponderada frente a otras rows con weight, mientras las rows
 *    sin weight siguen fijas en su tamaño natural. Esto también es
 *    exactamente el algoritmo estándar de flexbox: items con
 *    `flex-grow: 0` (sin weight) toman su tamaño de contenido primero, y el
 *    espacio libre restante se reparte entre los items con
 *    `flex-grow: weight` en esa proporción.
 */

export type ComponentNode = {
  id: string;
  kind: "component";
  type: ComponentType;
  subtype: string;
  name: string;
};

export type RowNode = {
  id: string;
  kind: "row";
  /** undefined = wrap content (tamaño natural). Definido = pondera el espacio sobrante. */
  weight?: number;
  components: ComponentNode[];
};

export type ColumnNode = {
  id: string;
  kind: "column";
  rows: RowNode[];
};

export type BodyNode = {
  id: string;
  kind: "body";
  columns: ColumnNode[];
};

export type DroppedPaletteItem = { type: ComponentType; subtype: string };

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createComponentNode(type: ComponentType, subtype: string, displayIndex: number): ComponentNode {
  return {
    id: nextId("component"),
    kind: "component",
    type,
    subtype,
    name: `${type} ${displayIndex}`,
  };
}

export function createEmptyBody(): BodyNode {
  return {
    id: nextId("body"),
    kind: "body",
    columns: [{ id: nextId("column"), kind: "column", rows: [] }],
  };
}

export function countComponentsOfType(body: BodyNode, type: ComponentType): number {
  let count = 0;
  for (const column of body.columns) {
    for (const row of column.rows) {
      for (const component of row.components) {
        if (component.type === type) count += 1;
      }
    }
  }
  return count;
}

export function findComponent(body: BodyNode, componentId: string): ComponentNode | undefined {
  for (const column of body.columns) {
    for (const row of column.rows) {
      const found = row.components.find((component) => component.id === componentId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findRow(body: BodyNode, rowId: string): RowNode | undefined {
  for (const column of body.columns) {
    const found = column.rows.find((row) => row.id === rowId);
    if (found) return found;
  }
  return undefined;
}
