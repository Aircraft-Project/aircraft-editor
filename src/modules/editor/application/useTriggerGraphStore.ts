import { create } from "zustand";
import type { SchemaValue } from "@/modules/aircraft-schema";

export interface EditorGraphNode {
  readonly id: string;
  readonly kind: "event" | "trigger";
  readonly type: string;
  readonly label: string;
  readonly properties: Readonly<Record<string, SchemaValue>>;
}

export interface EditorGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface EditorTriggerGraph {
  readonly nodes: EditorGraphNode[];
  readonly edges: EditorGraphEdge[];
  readonly selectedNodeId: string | null;
}

interface TriggerGraphState {
  bindingKey: string | null;
  graphs: Record<string, EditorTriggerGraph>;
  startEvent: (
    screenId: string,
    componentId: string,
    eventType: string,
    eventLabel: string,
  ) => void;
  addTrigger: (
    type: string,
    label: string,
    properties: Readonly<Record<string, SchemaValue>>,
  ) => void;
  connectNodes: (source: string, target: string) => void;
  selectNode: (id: string) => void;
  setNodeProperty: (
    id: string,
    property: string,
    value: SchemaValue,
  ) => void;
  reset: () => void;
}

let graphId = 0;
function nextGraphId(prefix: string): string {
  graphId += 1;
  return `${prefix}-${graphId}`;
}

export function createTriggerBindingKey(
  screenId: string,
  componentId: string,
  eventType: string,
): string {
  return [screenId, componentId, eventType]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export const useTriggerGraphStore = create<TriggerGraphState>((set) => ({
  bindingKey: null,
  graphs: {},

  startEvent: (screenId, componentId, eventType, eventLabel) =>
    set((state) => {
      const bindingKey = createTriggerBindingKey(
        screenId,
        componentId,
        eventType,
      );
      if (state.graphs[bindingKey]) {
        return { bindingKey };
      }

      const rootId = nextGraphId("event");
      return {
        bindingKey,
        graphs: {
          ...state.graphs,
          [bindingKey]: {
            nodes: [
              {
                id: rootId,
                kind: "event",
                type: eventType,
                label: eventLabel,
                properties: {},
              },
            ],
            edges: [],
            selectedNodeId: rootId,
          },
        },
      };
    }),

  addTrigger: (type, label, properties) =>
    set((state) => {
      if (!state.bindingKey) {
        return state;
      }
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph?.nodes.length) {
        return state;
      }

      const id = nextGraphId("trigger");
      const source =
        activeGraph.nodes.find(
          (node) => node.id === activeGraph.selectedNodeId,
        )?.id ?? activeGraph.nodes[activeGraph.nodes.length - 1].id;
      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            nodes: [
              ...activeGraph.nodes,
              { id, kind: "trigger", type, label, properties },
            ],
            edges: [
              ...activeGraph.edges,
              {
                id: nextGraphId("edge"),
                source,
                target: id,
              },
            ],
            selectedNodeId: id,
          },
        },
      };
    }),

  connectNodes: (source, target) =>
    set((state) => {
      if (!state.bindingKey) {
        return state;
      }
      const activeGraph = state.graphs[state.bindingKey];
      if (
        !activeGraph ||
        !activeGraph.nodes.some((node) => node.id === source) ||
        !activeGraph.nodes.some((node) => node.id === target) ||
        activeGraph.edges.some(
          (edge) => edge.source === source && edge.target === target,
        )
      ) {
        return state;
      }

      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            ...activeGraph,
            edges: [
              ...activeGraph.edges,
              { id: nextGraphId("edge"), source, target },
            ],
          },
        },
      };
    }),

  selectNode: (id) =>
    set((state) => {
      if (!state.bindingKey) {
        return state;
      }
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph?.nodes.some((node) => node.id === id)) {
        return state;
      }
      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            ...activeGraph,
            selectedNodeId: id,
          },
        },
      };
    }),

  setNodeProperty: (id, property, value) =>
    set((state) => {
      if (!state.bindingKey) {
        return state;
      }
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph) {
        return state;
      }
      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            ...activeGraph,
            nodes: activeGraph.nodes.map((node) =>
              node.id === id
                ? {
                    ...node,
                    properties: {
                      ...node.properties,
                      [property]: value,
                    },
                  }
                : node,
            ),
          },
        },
      };
    }),

  reset: () =>
    set({
      bindingKey: null,
      graphs: {},
    }),
}));
