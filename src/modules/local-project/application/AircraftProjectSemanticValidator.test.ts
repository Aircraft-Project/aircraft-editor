import { createTriggerBindingKey } from "@/modules/editor/application/useTriggerGraphStore";
import type {
  BodyNode,
  ComponentNode,
  RowNode,
} from "@/modules/screens/layoutTree";
import {
  DOCUMENT_VERSION,
  type CatalogItemDocument,
  type LayoutDocument,
  type ScreenDocument,
  type TriggerGraphBindingDocument,
  type TriggerGraphDocument,
} from "../domain";
import {
  AircraftProjectSemanticValidator,
  type SemanticProjectDocuments,
} from "./AircraftProjectSemanticValidator";

const screenId = "1111111111111111";
const bodyId = "2222222222222222";
const columnId = "3333333333333333";
const rowId = "4444444444444444";
const componentId = "5555555555555555";

function component(
  type = "Button",
  properties: Record<string, string> = {},
  id = componentId,
): ComponentNode {
  return {
    id,
    kind: "component",
    type: type as ComponentNode["type"],
    subtype: "default",
    name: type,
    properties,
    observers: [],
  };
}

function componentRow(
  value = component(),
  sizing: Pick<RowNode, "height" | "weight"> = { height: "wrap_content" },
): RowNode {
  return {
    id: rowId,
    kind: "row",
    content: "component",
    component: value,
    properties: {},
    ...sizing,
  };
}

function body(row: RowNode = componentRow()): BodyNode {
  return {
    id: bodyId,
    kind: "body",
    properties: {},
    columns: [
      {
        id: columnId,
        kind: "column",
        properties: {},
        rows: [row],
      },
    ],
  };
}

function screen(overrides: Partial<ScreenDocument> = {}): ScreenDocument {
  return {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    name: "Home",
    description: "Home",
    destination: "home",
    context: "interface",
    isInitial: true,
    order: 0,
    ...overrides,
  };
}

function catalogItem(
  overrides: Partial<CatalogItemDocument> = {},
): CatalogItemDocument {
  return {
    documentVersion: DOCUMENT_VERSION,
    catalogItemId: "movie-card",
    name: "movie-card",
    destination: "movie-card",
    context: "catalog-item",
    layout: {
      id: "aaaaaaaaaaaaaaaa",
      kind: "body",
      properties: {},
      columns: [
        {
          id: "bbbbbbbbbbbbbbbb",
          kind: "column",
          properties: {},
          rows: [],
        },
      ],
    },
    ...overrides,
  };
}

type MutableSemanticProject = {
  screens: ScreenDocument[];
  layouts: Record<string, LayoutDocument>;
  triggerGraphs: Record<string, TriggerGraphDocument>;
  catalogItems: CatalogItemDocument[];
};

function project(): MutableSemanticProject {
  const layout: LayoutDocument = {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    tree: body(),
  };
  const graph: TriggerGraphDocument = {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    graphs: {},
  };
  return {
    screens: [screen()],
    layouts: { [screenId]: layout },
    triggerGraphs: { [screenId]: graph },
    catalogItems: [],
  };
}

function codes(value: SemanticProjectDocuments): readonly string[] {
  return new AircraftProjectSemanticValidator()
    .validate(value)
    .map((issue) => issue.code);
}

function graphProject(
  graph: TriggerGraphBindingDocument,
): SemanticProjectDocuments {
  const value = project();
  const key = createTriggerBindingKey(screenId, componentId, "onClick");
  return {
    ...value,
    triggerGraphs: {
      [screenId]: {
        documentVersion: DOCUMENT_VERSION,
        screenId,
        graphs: { [key]: graph },
      },
    },
  };
}

function triggerNode(id: string, type = "Conditional") {
  return {
    id,
    kind: "trigger" as const,
    type,
    label: type,
    properties: {},
  };
}

function validGraph(): TriggerGraphBindingDocument {
  return {
    rootVertexId: "6666666666666666",
    nodes: [
      triggerNode("6666666666666666"),
      triggerNode("7777777777777777", "Navigation"),
    ],
    edges: [
      {
        id: "edge-a",
        source: "6666666666666666",
        target: "7777777777777777",
      },
      {
        id: "edge-b",
        source: "7777777777777777",
        target: "6666666666666666",
      },
    ],
    selectedNodeId: null,
  };
}

describe("AircraftProjectSemanticValidator", () => {
  it("accepts H-3 rows containing exactly one component", () => {
    expect(codes(project())).not.toContain("H-3");
  });

  it("accepts H-3 rows containing one-or-more columns", () => {
    const value = project();
    const columnsRow: RowNode = {
      id: rowId,
      kind: "row",
      content: "columns",
      columns: [
        {
          id: "6666666666666666",
          kind: "column",
          properties: {},
          rows: [],
        },
      ],
      height: "wrap_content",
      properties: {},
    };
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: body(columnsRow),
    };
    expect(codes(value)).not.toContain("H-3");
  });

  it.each([
    [
      "component plus column",
      {
        ...componentRow(),
        columns: [
          {
            id: "6666666666666666",
            kind: "column",
            properties: {},
            rows: [],
          },
        ],
      },
    ],
    [
      "two legacy components",
      {
        id: rowId,
        kind: "row",
        properties: {},
        children: [component(), component("TextLabel", {}, "6666666666666666")],
      },
    ],
  ])("rejects H-3 %s", (_name, invalidRow) => {
    const value = project();
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: body(invalidRow as unknown as RowNode),
    };
    expect(codes(value)).toContain("H-3");
  });

  it("rejects H-9 scrollable columns containing a vertical Catalog", () => {
    const value = project();
    value.catalogItems = [catalogItem()];
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: {
        ...body(
          componentRow(component("Catalog", { orientation: "vertical", itemView: "movie-card" }), {
            weight: 1,
          }),
        ),
        columns: [
          {
            ...body().columns[0],
            properties: { scrollable: true },
            rows: [
              componentRow(component("Catalog", { orientation: "vertical", itemView: "movie-card" }), {
                weight: 1,
              }),
            ],
          },
        ],
      },
    };
    expect(codes(value)).toContain("H-9");
  });

  it.each([
    ["without weight", { height: "wrap_content" as const }, true],
    ["with height", { height: 250 as const, weight: 1 }, true],
    ["with weight", { weight: 1 }, false],
  ])("validates H-10 vertical Catalog %s", (_name, sizing, invalid) => {
    const value = project();
    value.catalogItems = [catalogItem()];
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: body(
        componentRow(
          component("Catalog", {
            orientation: "vertical",
            itemView: "movie-card",
          }),
          sizing,
        ),
      ),
    };
    expect(codes(value).includes("H-10")).toBe(invalid);
  });

  it("rejects H-11 height plus weight", () => {
    const value = project();
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: body(componentRow(component(), { height: 250, weight: 1 })),
    };
    expect(codes(value)).toContain("H-11");
  });

  it("accepts a rooted reachable trigger cycle", () => {
    expect(codes(graphProject(validGraph()))).not.toEqual(
      expect.arrayContaining(["D-2", "D-4", "D-5"]),
    );
  });

  it("rejects a missing trigger root", () => {
    expect(
      codes(graphProject({ ...validGraph(), rootVertexId: "9999999999999999" })),
    ).toContain("D-2");
  });

  it("rejects an unreachable trigger vertex", () => {
    const graph = validGraph();
    expect(
      codes(
        graphProject({
          ...graph,
          edges: graph.edges.filter((edge) => edge.target !== "7777777777777777"),
        }),
      ),
    ).toContain("D-5");
  });

  it("rejects legacy Event nodes with multiple roots", () => {
    const graph = {
      ...validGraph(),
      rootVertexId: null,
      nodes: [
        {
          id: "event:onClick",
          kind: "event",
          type: "onClick",
          label: "Click",
          properties: {},
        },
        ...validGraph().nodes,
      ],
      edges: [
        {
          id: "event-a",
          source: "event:onClick",
          target: "6666666666666666",
        },
        {
          id: "event-b",
          source: "event:onClick",
          target: "7777777777777777",
        },
      ],
    } as unknown as TriggerGraphBindingDocument;
    expect(codes(graphProject(graph))).toContain("D-2");
  });

  it.each(["", "nested/path", "nested\\path"])(
    "rejects invalid destination %s",
    (destination) => {
      const value = project();
      value.screens = [screen({ destination })];
      expect(codes(value)).toContain("M-5");
    },
  );

  it("reports M-5 for duplicate interface destinations", () => {
    const value = project();
    value.screens.push(
      screen({
        screenId: "1212121212121212",
        name: "Details",
        destination: "home",
        isInitial: false,
        order: 1,
      }),
    );
    expect(codes(value)).toContain("M-5");
  });

  it("does not share M-5 between interfaces and CatalogItems", () => {
    const value = project();
    value.catalogItems = [catalogItem({ destination: "home" })];
    expect(codes(value)).not.toContain("M-5");
  });

  it("does not apply M-5 to duplicate CatalogItem destinations", () => {
    const value = project();
    value.catalogItems = [
      catalogItem({ destination: "card" }),
      catalogItem({
        catalogItemId: "actor-card",
        name: "actor-card",
        destination: "card",
      }),
    ];
    expect(codes(value)).not.toContain("M-5");
  });

  it("rejects CatalogItem identifier/name mismatches", () => {
    const value = project();
    value.catalogItems = [catalogItem({ name: "Movie card" })];
    expect(codes(value)).toContain("CATALOG_ITEM_IDENTITY_MISMATCH");
  });

  it("rejects missing interfaces and missing initial roots", () => {
    const missingInterfaces = project();
    missingInterfaces.screens = [];
    expect(codes(missingInterfaces)).toContain("M-1");

    const missingRoot = project();
    missingRoot.screens = [screen({ isInitial: false })];
    expect(codes(missingRoot)).toContain("M-2");
  });

  it("rejects duplicate interface names and identifiers", () => {
    const value = project();
    value.screens = [screen(), screen({ isInitial: false, order: 1 })];
    expect(codes(value)).toEqual(expect.arrayContaining(["M-3", "M-4"]));
  });

  it("scopes T-4 identifiers to each interface document", () => {
    const value = project();
    const secondScreenId = "1212121212121212";
    value.screens.push(
      screen({
        screenId: secondScreenId,
        name: "Details",
        destination: "details",
        isInitial: false,
        order: 1,
      }),
    );
    value.layouts[secondScreenId] = {
      documentVersion: DOCUMENT_VERSION,
      screenId: secondScreenId,
      tree: body(),
    };

    expect(codes(value)).not.toContain("T-4");
  });

  it("reports T-4 for duplicate component identifiers in one interface", () => {
    const value = project();
    const tree = body();
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: {
        ...tree,
        columns: [
          {
            ...tree.columns[0],
            rows: [
              componentRow(),
              { ...componentRow(), id: "8888888888888888" },
            ],
          },
        ],
      },
    };

    expect(codes(value)).toContain("T-4");
  });

  it("reports T-4 when a component and TriggerVertex share an identifier", () => {
    const graph = validGraph();
    const nodes = graph.nodes.map((node) =>
      node.id === graph.rootVertexId ? { ...node, id: componentId } : node,
    );
    const edges = graph.edges.map((edge) => ({
      ...edge,
      source: edge.source === graph.rootVertexId ? componentId : edge.source,
      target: edge.target === graph.rootVertexId ? componentId : edge.target,
    }));

    expect(
      codes(
        graphProject({
          ...graph,
          rootVertexId: componentId,
          nodes,
          edges,
        }),
      ),
    ).toContain("T-4");
  });

  it("shares T-4 scope between graphs of the same interface", () => {
    const value = project();
    const graph = validGraph();
    const firstKey = createTriggerBindingKey(screenId, componentId, "onClick");
    const secondKey = createTriggerBindingKey(
      screenId,
      componentId,
      "onValueChanged",
    );
    value.triggerGraphs[screenId] = {
      documentVersion: DOCUMENT_VERSION,
      screenId,
      graphs: { [firstKey]: graph, [secondKey]: graph },
    };

    expect(codes(value)).toContain("T-4");
  });

  it.each([
    ["known target", { type: "Navigate", target: screenId }, false],
    ["unknown target", { type: "Navigate", target: "missing-screen" }, true],
    ["missing target", { type: "Navigate" }, false],
  ])("applies M-6 only for an existing %s", (_, properties, expected) => {
    const graph = validGraph();
    const nodes = graph.nodes.map((node) =>
      node.id === "7777777777777777"
        ? { ...node, properties }
        : node,
    );
    expect(codes(graphProject({ ...graph, nodes })).includes("M-6")).toBe(
      expected,
    );
  });

  it.each([
    ["known itemView", { itemView: "movie-card" }, false],
    ["unknown itemView", { itemView: "missing" }, true],
    ["missing itemView", {}, false],
  ])("applies M-7 only for an existing %s", (_, properties, expected) => {
    const value = project();
    value.catalogItems = [catalogItem()];
    value.layouts[screenId] = {
      ...value.layouts[screenId],
      tree: body(componentRow(component("Catalog", properties))),
    };
    expect(codes(value).includes("M-7")).toBe(expected);
  });

  it("rejects duplicate CatalogItem identifiers", () => {
    const value = project();
    value.catalogItems = [
      catalogItem(),
      catalogItem({ destination: "movie-card-copy" }),
    ];
    expect(codes(value)).toContain("M-8");
  });
});
