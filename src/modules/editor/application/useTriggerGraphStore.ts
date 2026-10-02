import { create } from "zustand";
import type { SchemaValue } from "@/modules/aircraft-schema";
import type { TriggerPersistenceMetadata } from "@/modules/local-project";
import {
  collectLayoutIdentifiers,
  createAircraftIdentifier,
} from "@/modules/screens/layoutTree";
import { useEditorStore } from "@/store/useEditorStore";

export interface EditorGraphNode {
  readonly id: string;
  readonly kind: "event" | "trigger";
  readonly type: string;
  readonly label: string;
  readonly properties: Readonly<Record<string, SchemaValue>>;
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly persistence?: TriggerPersistenceMetadata;
}

export interface EditorGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface EditorTriggerGraph {
  readonly rootVertexId: string | null;
  readonly nodes: EditorGraphNode[];
  readonly edges: EditorGraphEdge[];
  readonly selectedNodeId: string | null;
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
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
  hydrateGraphs: (graphs: Readonly<Record<string, EditorTriggerGraph>>) => void;
  reset: () => void;
}

function collectSemanticIdentifiers(
  graphs: Readonly<Record<string, EditorTriggerGraph>>,
): Set<string> {
  const identifiers = new Set<string>();
  const editor = useEditorStore.getState();
  Object.values(editor.screenTrees).forEach((body) =>
    collectLayoutIdentifiers(body).forEach((id) => identifiers.add(id)),
  );
  editor.catalogItems.forEach((item) =>
    collectLayoutIdentifiers(item.layout).forEach((id) => identifiers.add(id)),
  );
  editor.screens.forEach((screen) => identifiers.add(screen.id));
  for (const graph of Object.values(graphs)) {
    graph.nodes
      .filter((node) => node.kind === "trigger")
      .forEach((node) => identifiers.add(node.id));
  }
  return identifiers;
}

function nextSemanticId(
  graphs: Readonly<Record<string, EditorTriggerGraph>>,
): string {
  return createAircraftIdentifier(collectSemanticIdentifiers(graphs));
}

function nextEdgeId(graphs: Readonly<Record<string, EditorTriggerGraph>>): string {
  const identifiers = collectSemanticIdentifiers(graphs);
  Object.values(graphs).forEach((graph) =>
    graph.edges.forEach((edge) => identifiers.add(edge.id)),
  );
  return createAircraftIdentifier(identifiers);
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

export function parseTriggerBindingKey(bindingKey: string): {
  readonly screenId: string;
  readonly componentId: string;
  readonly eventType: string;
} | null {
  const parts = bindingKey.split(":");
  if (parts.length !== 3) return null;
  try {
    return {
      screenId: decodeURIComponent(parts[0]),
      componentId: decodeURIComponent(parts[1]),
      eventType: decodeURIComponent(parts[2]),
    };
  } catch {
    return null;
  }
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
      if (state.graphs[bindingKey]) return { bindingKey };

      const eventId = `event:${eventType}`;
      return {
        bindingKey,
        graphs: {
          ...state.graphs,
          [bindingKey]: {
            rootVertexId: null,
            nodes: [
              {
                id: eventId,
                kind: "event",
                type: eventType,
                label: eventLabel,
                properties: {},
              },
            ],
            edges: [],
            selectedNodeId: eventId,
          },
        },
      };
    }),

  addTrigger: (type, label, properties) =>
    set((state) => {
      if (!state.bindingKey) return state;
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph?.nodes.length) return state;

      const id = nextSemanticId(state.graphs);
      const eventNode = activeGraph.nodes.find((node) => node.kind === "event");
      const selected = activeGraph.nodes.find(
        (node) => node.id === activeGraph.selectedNodeId,
      );
      const triggers = activeGraph.nodes.filter(
        (node) => node.kind === "trigger",
      );
      const source =
        activeGraph.rootVertexId === null
          ? eventNode?.id
          : selected?.kind === "trigger"
            ? selected.id
            : triggers[triggers.length - 1]?.id;
      if (!source) return state;

      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            ...activeGraph,
            rootVertexId: activeGraph.rootVertexId ?? id,
            nodes: [
              ...activeGraph.nodes,
              { id, kind: "trigger", type, label, properties },
            ],
            edges: [
              ...activeGraph.edges,
              {
                id: nextEdgeId(state.graphs),
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
      if (!state.bindingKey) return state;
      const activeGraph = state.graphs[state.bindingKey];
      const sourceNode = activeGraph?.nodes.find((node) => node.id === source);
      const targetNode = activeGraph?.nodes.find((node) => node.id === target);
      if (
        !activeGraph ||
        !sourceNode ||
        !targetNode ||
        targetNode.kind === "event" ||
        activeGraph.edges.some(
          (edge) => edge.source === source && edge.target === target,
        )
      ) {
        return state;
      }

      if (
        sourceNode.kind === "event" &&
        activeGraph.rootVertexId !== null &&
        activeGraph.rootVertexId !== target
      ) {
        return state;
      }

      return {
        graphs: {
          ...state.graphs,
          [state.bindingKey]: {
            ...activeGraph,
            rootVertexId:
              sourceNode.kind === "event"
                ? target
                : activeGraph.rootVertexId,
            edges: [
              ...activeGraph.edges,
              { id: nextEdgeId(state.graphs), source, target },
            ],
          },
        },
      };
    }),

  selectNode: (id) =>
    set((state) => {
      if (!state.bindingKey) return state;
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph?.nodes.some((node) => node.id === id)) return state;
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
      if (!state.bindingKey) return state;
      const activeGraph = state.graphs[state.bindingKey];
      if (!activeGraph) return state;
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

  hydrateGraphs: (graphs) =>
    set({
      bindingKey: null,
      graphs: structuredClone(graphs),
    }),

  reset: () =>
    set({
      bindingKey: null,
      graphs: {},
    }),
}));
