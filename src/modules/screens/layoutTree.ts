import { ComponentType } from "@/design/tokens";
import type { SchemaValue } from "@/modules/aircraft-schema";

/**
 * Modelo de AST simplificado (Body → Column → Row → (Component | Column)), PRD §4.1.
 * Una Row puede dividirse en Columns hijas (para subdividir el ancho de esa
 * Row), que a su vez vuelven a tener Rows — el árbol es recursivo sin límite
 * de profundidad, igual que en el diagrama de referencia del usuario:
 * Column → Row[] → (Component | Column[] → Row[] → Component).
 *
 * Reglas de tamaño (dadas por el usuario, no están en el PRD):
 *
 *  - Column expone el ancho. Toda Column tiene un `weight` (default 1).
 *    El ancho de cada Column se calcula con:
 *      Anchura% = (weight * 100) / suma(weight de todas las columns hermanas)
 *    "Hermanas" son las demás columns en la misma lista: las del Body, o las
 *    demás Column-hijas dentro de la misma Row si la Row fue subdividida.
 *    Se mapea 1:1 a flexbox: `flex-grow: weight` con `flex-basis: 0%` sobre
 *    todas las columns de esa lista — flexbox ya reparte el 100% del ancho
 *    proporcionalmente a los grow factors, sin cálculo manual de %.
 *
 *  - Row expone el alto. Row tiene `height` (wrap_content por default) y un
 *    `weight` opcional.
 *      - Sin weight: se respeta `height` tal cual (wrap_content = tamaño
 *        natural del contenido; match_parent = ocupa el espacio vertical
 *        sobrante de la Column, sin competir por proporción con nadie más).
 *      - Con weight: `height` se ignora por completo (weight siempre gana,
 *        sin importar qué diga height) y la Row compite por el espacio
 *        vertical sobrante de la Column de forma ponderada frente a sus
 *        rows hermanas con weight, con la misma fórmula que Column:
 *          Altura% = (weight * 100) / suma(weight de todas las rows con weight)
 *        Las rows sin weight se miden primero por su tamaño natural/último
 *        disponible, y lo que sobra es el 100% que se reparte entre las
 *        rows con weight. Esto es exactamente el algoritmo estándar de
 *        flexbox: items con `flex-grow: 0` toman su tamaño primero, y el
 *        espacio libre restante se reparte entre los items con
 *        `flex-grow: weight` en esa proporción.
 *
 *  - Los hijos de una Row (`RowNode.children`) son una lista mixta de
 *    Component y Column. Los Components sueltos ocupan su tamaño natural
 *    (no participan de ningún weight); las Columns hijas de esa Row dividen
 *    entre sí el ancho *sobrante* de la Row con la misma fórmula de Column,
 *    igual que las rows wrap_content vs con weight en el eje vertical.
 */

export type RowHeight = "wrap_content" | "match_parent";

export type ComponentNode = {
  id: string;
  kind: "component";
  type: ComponentType;
  subtype: string;
  name: string;
  properties: Record<string, SchemaValue>;
};

/** Hijo de una Row: un Component hoja, o una Column que subdivide la Row. */
export type RowChild = ComponentNode | ColumnNode;

export type RowNode = {
  id: string;
  kind: "row";
  height: RowHeight;
  /** Si está definido, `height` se ignora por completo (ver Casuística 2). */
  weight?: number;
  children: RowChild[];
};

export type ColumnNode = {
  id: string;
  kind: "column";
  weight: number;
  rows: RowNode[];
};

export type BodyNode = {
  id: string;
  kind: "body";
  columns: ColumnNode[];
};

export type DroppedPaletteItem = {
  type: ComponentType;
  subtype: string;
  initialProperties?: Record<string, SchemaValue>;
};

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createComponentNode(
  type: ComponentType,
  subtype: string,
  displayIndex: number,
  initialProperties: Record<string, SchemaValue> = {},
): ComponentNode {
  return {
    id: nextId("component"),
    kind: "component",
    type,
    subtype,
    name: `${type} ${displayIndex}`,
    properties: initialProperties,
  };
}

export function createRowNode(children: RowChild[]): RowNode {
  return { id: nextId("row"), kind: "row", height: "wrap_content", children };
}

export function createColumnNode(): ColumnNode {
  return { id: nextId("column"), kind: "column", weight: 1, rows: [] };
}

export function createEmptyBody(): BodyNode {
  return {
    id: nextId("body"),
    kind: "body",
    columns: [createColumnNode()],
  };
}

// ---------------------------------------------------------------------------
// Lecturas recursivas (buscan en toda la profundidad del árbol)
// ---------------------------------------------------------------------------

export function countComponentsOfType(body: BodyNode, type: ComponentType): number {
  let count = 0;
  const visitColumn = (column: ColumnNode) => {
    for (const row of column.rows) {
      for (const child of row.children) {
        if (child.kind === "component") {
          if (child.type === type) count += 1;
        } else {
          visitColumn(child);
        }
      }
    }
  };
  body.columns.forEach(visitColumn);
  return count;
}

export function findComponent(body: BodyNode, componentId: string): ComponentNode | undefined {
  const searchColumn = (column: ColumnNode): ComponentNode | undefined => {
    for (const row of column.rows) {
      for (const child of row.children) {
        if (child.kind === "component") {
          if (child.id === componentId) return child;
        } else {
          const found = searchColumn(child);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = searchColumn(column);
    if (found) return found;
  }
  return undefined;
}

export function findRow(body: BodyNode, rowId: string): RowNode | undefined {
  const searchColumn = (column: ColumnNode): RowNode | undefined => {
    for (const row of column.rows) {
      if (row.id === rowId) return row;
      for (const child of row.children) {
        if (child.kind === "column") {
          const found = searchColumn(child);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = searchColumn(column);
    if (found) return found;
  }
  return undefined;
}

export function findColumn(body: BodyNode, columnId: string): ColumnNode | undefined {
  const searchColumn = (column: ColumnNode): ColumnNode | undefined => {
    if (column.id === columnId) return column;
    for (const row of column.rows) {
      for (const child of row.children) {
        if (child.kind === "column") {
          const found = searchColumn(child);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = searchColumn(column);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Actualizaciones inmutables recursivas (reconstruyen el árbol completo)
// ---------------------------------------------------------------------------

function mapColumnRows(column: ColumnNode, mapRow: (row: RowNode) => RowNode): ColumnNode {
  return { ...column, rows: column.rows.map(mapRow) };
}

function mapRowChildren(row: RowNode, mapChild: (child: RowChild) => RowChild): RowNode {
  return { ...row, children: row.children.map(mapChild) };
}

export function updateColumnDeep(body: BodyNode, columnId: string, updater: (column: ColumnNode) => ColumnNode): BodyNode {
  const transform = (column: ColumnNode): ColumnNode => {
    if (column.id === columnId) return updater(column);
    return mapColumnRows(column, (row) =>
      mapRowChildren(row, (child) => (child.kind === "column" ? transform(child) : child))
    );
  };
  return { ...body, columns: body.columns.map(transform) };
}

export function updateRowDeep(body: BodyNode, rowId: string, updater: (row: RowNode) => RowNode): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) => {
      if (row.id === rowId) return updater(row);
      return mapRowChildren(row, (child) => (child.kind === "column" ? transformColumn(child) : child));
    });
  return { ...body, columns: body.columns.map(transformColumn) };
}

export function updateComponentDeep(
  body: BodyNode,
  componentId: string,
  updater: (component: ComponentNode) => ComponentNode
): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) =>
      mapRowChildren(row, (child) => {
        if (child.kind === "component") return child.id === componentId ? updater(child) : child;
        return transformColumn(child);
      })
    );
  return { ...body, columns: body.columns.map(transformColumn) };
}

/** Quita una Row de donde esté (Column de primer nivel o anidada dentro de otra Row). */
export function removeRowDeep(body: BodyNode, rowId: string): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode => ({
    ...column,
    rows: column.rows
      .filter((row) => row.id !== rowId)
      .map((row) => mapRowChildren(row, (child) => (child.kind === "column" ? transformColumn(child) : child))),
  });
  return { ...body, columns: body.columns.map(transformColumn) };
}

/**
 * Quita una Column de donde esté. Si es una Column de primer nivel del Body,
 * no se elimina si es la única (el Body siempre necesita al menos 1);
 * las Columns anidadas dentro de una Row no tienen ese mínimo.
 */
export function removeColumnDeep(body: BodyNode, columnId: string): BodyNode {
  const removeFromColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) => ({
      ...row,
      children: row.children
        .filter((child) => !(child.kind === "column" && child.id === columnId))
        .map((child) => (child.kind === "column" ? removeFromColumn(child) : child)),
    }));

  const isTopLevel = body.columns.some((column) => column.id === columnId);
  if (isTopLevel && body.columns.length <= 1) {
    return body;
  }

  const columns = body.columns.filter((column) => column.id !== columnId).map(removeFromColumn);
  return { ...body, columns };
}


export function listComponents(body: BodyNode): ComponentNode[] {
  const components: ComponentNode[] = [];
  const visitColumn = (column: ColumnNode) => {
    for (const row of column.rows) {
      for (const child of row.children) {
        if (child.kind === "component") {
          components.push(child);
        } else {
          visitColumn(child);
        }
      }
    }
  };

  body.columns.forEach(visitColumn);
  return components;
}

export function cloneBody(body: BodyNode): BodyNode {
  const cloneColumn = (column: ColumnNode): ColumnNode => ({
    ...column,
    id: nextId("column"),
    rows: column.rows.map(cloneRow),
  });
  const cloneRow = (row: RowNode): RowNode => ({
    ...row,
    id: nextId("row"),
    children: row.children.map((child) =>
      child.kind === "component"
        ? {
            ...child,
            id: nextId("component"),
            properties: { ...child.properties },
          }
        : cloneColumn(child),
    ),
  });

  return {
    ...body,
    id: nextId("body"),
    columns: body.columns.map(cloneColumn),
  };
}
