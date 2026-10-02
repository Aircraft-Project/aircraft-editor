import type { BodyNode } from "@/modules/screens/layoutTree";
import { AircraftProjectSemanticError } from "../domain";
import {
  createLayoutDocument,
  createTriggerGraphDocument,
  normalizeBody,
} from "./projectMapper";

describe("projectMapper semantic compatibility", () => {
  it("normalizes legacy structural properties and enforces height XOR weight", () => {
    const legacy = {
      id: "body-legacy",
      kind: "body",
      columns: [
        {
          id: "column-legacy",
          kind: "column",
          weight: 1,
          rows: [
            {
              id: "row-legacy",
              kind: "row",
              height: 250,
              weight: 2,
              children: [],
            },
          ],
        },
      ],
    } as unknown as BodyNode;

    const normalized = normalizeBody(legacy);
    const row = normalized.columns[0].rows[0];

    expect(normalized.properties).toEqual({});
    expect(normalized.columns[0].properties).toEqual({});
    expect(row.properties).toEqual({});
    expect(row.weight).toBe(2);
    expect(row.height).toBeUndefined();
    expect(createLayoutDocument("screen-1", legacy).tree).toEqual(normalized);
  });

  it("preserves known and unknown structural semantics without duplicating sizing", () => {
    const body: BodyNode = {
      id: "body",
      kind: "body",
      properties: {
        cardPadding: 12,
        cardBackgroundColor: "FFFFFF",
        futureBodyProperty: "preserve-me",
      },
      columns: [
        {
          id: "column",
          kind: "column",
          properties: {
            padding: 8,
            scrollable: true,
            futureColumnProperty: 42,
          },
          rows: [
            {
              id: "row",
              kind: "row",
              height: 250,
              properties: {
                padding: 4,
                horizontalArrangement: "SpaceBetween",
                verticalAlignment: "CenterVertically",
                futureRowProperty: false,
              },
              content: "empty",
            },
          ],
        },
      ],
    };

    const normalized = normalizeBody(body);
    expect(normalized).toEqual(body);
    expect(normalized.columns[0].editorMetadata).toBeUndefined();
    expect(normalized.columns[0].rows[0].properties).not.toHaveProperty(
      "height",
    );
    expect(normalized.columns[0].rows[0].properties).not.toHaveProperty(
      "weight",
    );
  });

  it.each([
    [
      "mixed component and column",
      {
        id: "row-mixed",
        kind: "row",
        children: [
          {
            id: "component-a",
            kind: "component",
            type: "Button",
            subtype: "Primary",
            name: "Button",
            properties: {},
            observers: [],
          },
          {
            id: "column-nested",
            kind: "column",
            properties: {},
            rows: [],
          },
        ],
      },
    ],
    [
      "multiple components",
      {
        id: "row-components",
        kind: "row",
        children: [
          {
            id: "component-a",
            kind: "component",
            type: "Button",
            subtype: "Primary",
            name: "Button A",
            properties: {},
            observers: [],
          },
          {
            id: "component-b",
            kind: "component",
            type: "TextLabel",
            subtype: "Default",
            name: "Label B",
            properties: {},
            observers: [],
          },
        ],
      },
    ],
  ])("rejects lossful legacy H-3 normalization for %s", (_name, row) => {
    const legacy = {
      id: "legacy-body",
      kind: "body",
      columns: [
        {
          id: "legacy-column",
          kind: "column",
          rows: [row],
        },
      ],
    } as unknown as BodyNode;

    expect(() => normalizeBody(legacy)).toThrow(AircraftProjectSemanticError);
  });

  it("preserves observers, mcpMetadata, node extensions, and legacy Column.weight", () => {
    const legacy = {
      id: "body-meta",
      kind: "body",
      properties: {},
      mcpMetadata: { body: "keep" },
      extensions: { futureBody: true },
      columns: [
        {
          id: "column-meta",
          kind: "column",
          weight: 3,
          properties: { paddingTop: 12 },
          mcpMetadata: { column: "keep" },
          extensions: { futureColumn: "keep" },
          rows: [
            {
              id: "row-meta",
              kind: "row",
              content: "component",
              height: "wrap_content",
              properties: { paddingStart: 4 },
              mcpMetadata: { row: "keep" },
              extensions: { futureRow: 1 },
              component: {
                id: "component-meta",
                kind: "component",
                type: "Button",
                subtype: "Primary",
                name: "Button",
                properties: { paddingEnd: 8 },
                observers: [{ observerIdentifier: "observer-a" }],
                mcpMetadata: { component: "keep" },
                extensions: { futureComponent: "keep" },
              },
            },
          ],
        },
      ],
    } as unknown as BodyNode;

    const document = createLayoutDocument("screen-meta", legacy, {
      futureLayout: "keep",
    });
    const row = document.tree.columns[0].rows[0];
    expect(document.extensions).toEqual({ futureLayout: "keep" });
    expect(document.tree.mcpMetadata).toEqual({ body: "keep" });
    expect(document.tree.columns[0]).toMatchObject({
      properties: { paddingTop: 12 },
      editorMetadata: { legacyWeight: 3 },
      mcpMetadata: { column: "keep" },
      extensions: { futureColumn: "keep" },
    });
    expect(row).toMatchObject({
      mcpMetadata: { row: "keep" },
      extensions: { futureRow: 1 },
    });
    expect(row.content).toBe("component");
    if (row.content === "component") {
      expect(row.component.observers).toEqual([
        { observerIdentifier: "observer-a" },
      ]);
      expect(row.component.mcpMetadata).toEqual({ component: "keep" });
      expect(row.component.extensions).toEqual({ futureComponent: "keep" });
      expect(row.component.properties).toMatchObject({ paddingEnd: 8 });
    }
    expect(document.tree.columns[0]).not.toHaveProperty("weight");
  });

  it("persists Event as UI-only while preserving trigger root and metadata", () => {
    const bindingKey = "screen-a:component-a:onClick";
    const document = createTriggerGraphDocument(
      "screen-a",
      {
        [bindingKey]: {
          rootVertexId: "trigger-a",
          nodes: [
            {
              id: "event:onClick",
              kind: "event",
              type: "onClick",
              label: "Click",
              properties: {},
            },
            {
              id: "trigger-a",
              kind: "trigger",
              type: "Conditional",
              label: "Conditional",
              properties: {},
              mcpMetadata: { vertex: "keep" },
            },
          ],
          edges: [
            {
              id: "ui-edge",
              source: "event:onClick",
              target: "trigger-a",
            },
            {
              id: "semantic-cycle",
              source: "trigger-a",
              target: "trigger-a",
            },
          ],
          selectedNodeId: "event:onClick",
          mcpMetadata: { graph: "keep" },
          extensions: { futureBinding: "keep" },
        },
      },
      { futureDocument: "keep" },
    );

    expect(document.extensions).toEqual({ futureDocument: "keep" });
    expect(document.graphs[bindingKey]).toMatchObject({
      rootVertexId: "trigger-a",
      selectedNodeId: null,
      mcpMetadata: { graph: "keep" },
      extensions: { futureBinding: "keep" },
    });
    expect(document.graphs[bindingKey].nodes).toEqual([
      expect.objectContaining({
        id: "trigger-a",
        kind: "trigger",
        mcpMetadata: { vertex: "keep" },
      }),
    ]);
    expect(document.graphs[bindingKey].edges).toEqual([
      expect.objectContaining({ id: "semantic-cycle" }),
    ]);
  });});
