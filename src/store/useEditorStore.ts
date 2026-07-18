import { create } from "zustand";
import {
  BodyNode,
  DroppedPaletteItem,
  RowNode,
  countComponentsOfType,
  createComponentNode,
  createEmptyBody,
  nextId,
} from "@/modules/screens/layoutTree";

export type CanvasMode = "layout" | "trigger-graph";

export type Selection = { kind: "component"; id: string } | { kind: "row"; id: string } | null;

type EditorState = {
  mode: CanvasMode;
  activeScreenId: string;
  /** Evento activo cuando mode === "trigger-graph" (PRD §6.2). */
  activeEvent: { componentName: string; eventName: string } | null;
  screenTrees: Record<string, BodyNode>;
  selection: Selection;

  setActiveScreen: (screenId: string) => void;
  openTriggerGraph: (componentName: string, eventName: string) => void;
  backToLayout: () => void;

  selectComponent: (id: string) => void;
  selectRow: (id: string) => void;
  clearSelection: () => void;

  addColumn: () => void;
  removeColumn: (columnId: string) => void;
  removeRow: (rowId: string) => void;
  setRowWeight: (rowId: string, weight: number | undefined) => void;
  renameComponent: (componentId: string, name: string) => void;
  dropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  dropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

const initialScreenTrees: Record<string, BodyNode> = {
  home: createEmptyBody(),
  login: createEmptyBody(),
};

function updateActiveBody(
  state: Pick<EditorState, "screenTrees" | "activeScreenId">,
  updater: (body: BodyNode) => BodyNode
): Pick<EditorState, "screenTrees"> {
  const body = state.screenTrees[state.activeScreenId];
  return { screenTrees: { ...state.screenTrees, [state.activeScreenId]: updater(body) } };
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: "layout",
  activeScreenId: "home",
  activeEvent: null,
  screenTrees: initialScreenTrees,
  selection: null,

  setActiveScreen: (screenId) => set({ activeScreenId: screenId, selection: null, mode: "layout", activeEvent: null }),

  openTriggerGraph: (componentName, eventName) =>
    set({ mode: "trigger-graph", activeEvent: { componentName, eventName } }),

  backToLayout: () => set({ mode: "layout", activeEvent: null }),

  selectComponent: (id) => set({ selection: { kind: "component", id } }),
  selectRow: (id) => set({ selection: { kind: "row", id } }),
  clearSelection: () => set({ selection: null }),

  addColumn: () =>
    set((state) => ({
      ...updateActiveBody(state, (body) => ({
        ...body,
        columns: [...body.columns, { id: nextId("column"), kind: "column", rows: [] }],
      })),
    })),

  removeColumn: (columnId) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      if (body.columns.length <= 1) return {};
      return {
        ...updateActiveBody(state, (b) => ({ ...b, columns: b.columns.filter((c) => c.id !== columnId) })),
        selection: null,
      };
    }),

  removeRow: (rowId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => ({
        ...body,
        columns: body.columns.map((column) => ({ ...column, rows: column.rows.filter((row) => row.id !== rowId) })),
      })),
      selection: null,
    })),

  setRowWeight: (rowId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => ({
        ...body,
        columns: body.columns.map((column) => ({
          ...column,
          rows: column.rows.map((row) => (row.id === rowId ? { ...row, weight } : row)),
        })),
      })),
    })),

  renameComponent: (componentId, name) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => ({
        ...body,
        columns: body.columns.map((column) => ({
          ...column,
          rows: column.rows.map((row) => ({
            ...row,
            components: row.components.map((component) =>
              component.id === componentId ? { ...component, name } : component
            ),
          })),
        })),
      })),
    })),

  dropOnColumn: (columnId, item) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(item.type, item.subtype, displayIndex);
      const newRow: RowNode = { id: nextId("row"), kind: "row", components: [component] };
      return {
        ...updateActiveBody(state, (b) => ({
          ...b,
          columns: b.columns.map((column) => (column.id === columnId ? { ...column, rows: [...column.rows, newRow] } : column)),
        })),
        selection: { kind: "component", id: component.id },
      };
    }),

  dropOnRow: (rowId, item) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(item.type, item.subtype, displayIndex);
      return {
        ...updateActiveBody(state, (b) => ({
          ...b,
          columns: b.columns.map((column) => ({
            ...column,
            rows: column.rows.map((row) =>
              row.id === rowId ? { ...row, components: [...row.components, component] } : row
            ),
          })),
        })),
        selection: { kind: "component", id: component.id },
      };
    }),
}));
