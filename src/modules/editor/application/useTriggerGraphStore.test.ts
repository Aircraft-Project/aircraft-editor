import {
  createTriggerBindingKey,
  useTriggerGraphStore,
} from "./useTriggerGraphStore";

function openGraph(
  screenId: string,
  componentId: string,
  eventType: string,
): string {
  useTriggerGraphStore
    .getState()
    .startEvent(screenId, componentId, eventType, eventType);
  return createTriggerBindingKey(screenId, componentId, eventType);
}

function addTrigger(type: string): void {
  useTriggerGraphStore.getState().addTrigger(type, type, {});
}

describe("useTriggerGraphStore", () => {
  beforeEach(() => {
    useTriggerGraphStore.getState().reset();
  });

  it("keeps graph A when graph B is opened", () => {
    const graphAKey = openGraph("screen-a", "component-a", "event-a");
    addTrigger("Navigation");
    const graphA = useTriggerGraphStore.getState().graphs[graphAKey];

    openGraph("screen-a", "component-a", "event-b");
    addTrigger("Math");

    expect(useTriggerGraphStore.getState().graphs[graphAKey]).toEqual(
      graphA,
    );
  });

  it("restores graph A nodes, edges, and selection after returning from graph B", () => {
    const graphAKey = openGraph("screen-a", "component-a", "event-a");
    addTrigger("Navigation");
    addTrigger("Conditional");
    const graphA = useTriggerGraphStore.getState().graphs[graphAKey];

    openGraph("screen-a", "component-a", "event-b");
    addTrigger("ApiService");
    openGraph("screen-a", "component-a", "event-a");

    const state = useTriggerGraphStore.getState();
    expect(state.bindingKey).toBe(graphAKey);
    expect(state.graphs[graphAKey]).toEqual(graphA);
    expect(state.graphs[graphAKey].nodes).toHaveLength(3);
    expect(state.graphs[graphAKey].edges).toHaveLength(2);
  });

  it("keeps bindings for different components independent", () => {
    const firstKey = openGraph("screen-a", "component-a", "event-a");
    addTrigger("Navigation");
    const secondKey = openGraph("screen-a", "component-b", "event-a");
    addTrigger("Math");

    const { graphs } = useTriggerGraphStore.getState();
    expect(graphs[firstKey].nodes[1].type).toBe("Navigation");
    expect(graphs[secondKey].nodes[1].type).toBe("Math");
    expect(graphs[firstKey]).not.toBe(graphs[secondKey]);
  });

  it("keeps bindings for different events independent", () => {
    const firstKey = openGraph("screen-a", "component-a", "event-a");
    addTrigger("Conditional");
    const secondKey = openGraph("screen-a", "component-a", "event-b");
    addTrigger("StringEngine");

    const { graphs } = useTriggerGraphStore.getState();
    expect(graphs[firstKey].nodes[1].type).toBe("Conditional");
    expect(graphs[secondKey].nodes[1].type).toBe("StringEngine");
  });

  it("allows a controlled connection that creates a cycle", () => {
    const graphKey = openGraph("screen-a", "component-a", "event-a");
    addTrigger("Conditional");
    addTrigger("Navigation");
    const graph = useTriggerGraphStore.getState().graphs[graphKey];
    const firstTrigger = graph.nodes[1];
    const secondTrigger = graph.nodes[2];

    useTriggerGraphStore
      .getState()
      .connectNodes(secondTrigger.id, firstTrigger.id);

    expect(
      useTriggerGraphStore
        .getState()
        .graphs[graphKey].edges.some(
          (edge) =>
            edge.source === secondTrigger.id &&
            edge.target === firstTrigger.id,
        ),
    ).toBe(true);
  });
});
