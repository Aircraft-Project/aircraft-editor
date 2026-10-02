import {
  findRow,
  listComponents,
  type BodyNode,
} from "@/modules/screens/layoutTree";
import { useEditorStore } from "./useEditorStore";

const screenId = "screen-h11";
const rowId = "row-h11";

function hydrateRow(height: "wrap_content" | "match_parent" | number): void {
  const tree: BodyNode = {
    id: "body-h11",
    kind: "body",
    properties: {},
    columns: [
      {
        id: "column-h11",
        kind: "column",
        properties: {},
        rows: [
          {
            id: rowId,
            kind: "row",
            height,
            properties: {},
            content: "empty",
          },
        ],
      },
    ],
  };
  useEditorStore.getState().hydrateEditor({
    screens: [
      {
        id: screenId,
        name: "H-11",
        description: "Sizing semantics",
        destination: "h-11",
        context: "interface",
      },
    ],
    initialScreenId: screenId,
    activeScreenId: screenId,
    screenTrees: { [screenId]: tree },
    catalogItems: [],
  });
}

function currentRow() {
  return findRow(useEditorStore.getState().screenTrees[screenId], rowId);
}

describe("useEditorStore row sizing", () => {
  beforeEach(() => useEditorStore.getState().resetEditor());

  it("keeps height and weight mutually exclusive", () => {
    hydrateRow(250);

    useEditorStore.getState().setRowWeight(rowId, 2);
    expect(currentRow()).toMatchObject({ weight: 2 });
    expect(currentRow()?.height).toBeUndefined();

    useEditorStore.getState().setRowWeight(rowId, undefined);
    expect(currentRow()?.height).toBe("wrap_content");
    expect(currentRow()?.weight).toBeUndefined();

    useEditorStore.getState().setRowHeight(rowId, "match_parent");
    expect(currentRow()?.height).toBe("match_parent");
    expect(currentRow()?.weight).toBeUndefined();
  });

  it("creates new semantic nodes after hydrate without colliding with persisted ids", () => {
    const persisted: BodyNode = {
      id: "0000000000000000",
      kind: "body",
      properties: {},
      columns: [
        {
          id: "1111111111111111",
          kind: "column",
          properties: {},
          rows: [
            {
              id: "2222222222222222",
              kind: "row",
              content: "component",
              height: "wrap_content",
              properties: {},
              component: {
                id: "3333333333333333",
                kind: "component",
                type: "Button",
                subtype: "Primary",
                name: "Button",
                properties: {},
                observers: [],
              },
            },
          ],
        },
      ],
    };
    useEditorStore.getState().hydrateEditor({
      screens: [
        {
          id: "4444444444444444",
          name: "Persisted",
          description: "Persisted",
          destination: "persisted",
          context: "interface",
        },
      ],
      initialScreenId: "4444444444444444",
      activeScreenId: "4444444444444444",
      screenTrees: { "4444444444444444": persisted },
      catalogItems: [],
    });

    useEditorStore.getState().dropOnColumn("1111111111111111", {
      type: "Button",
      subtype: "Secondary",
    });

    const ids = listComponents(
      useEditorStore.getState().screenTrees["4444444444444444"],
    ).map((component) => component.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prevents H-3 mutations between component and column row modes", () => {
    hydrateRow("wrap_content");
    useEditorStore.getState().dropOnRow(rowId, {
      type: "Button",
      subtype: "Primary",
    });
    const componentRow = currentRow();
    expect(componentRow?.content).toBe("component");

    useEditorStore.getState().addColumnToRow(rowId);
    expect(currentRow()).toEqual(componentRow);

    hydrateRow("wrap_content");
    useEditorStore.getState().addColumnToRow(rowId);
    const columnsRow = currentRow();
    expect(columnsRow?.content).toBe("columns");

    useEditorStore.getState().dropOnRow(rowId, {
      type: "Button",
      subtype: "Primary",
    });
    expect(currentRow()).toEqual(columnsRow);
  });

  it("blocks H-9 and gives vertical Catalog rows valid H-10 sizing", () => {
    hydrateRow("wrap_content");
    useEditorStore.setState((state) => ({
      screenTrees: {
        ...state.screenTrees,
        [screenId]: {
          ...state.screenTrees[screenId],
          columns: state.screenTrees[screenId].columns.map((column) => ({
            ...column,
            properties: { ...column.properties, scrollable: true },
          })),
        },
      },
    }));
    useEditorStore.getState().dropOnRow(rowId, {
      type: "Catalog",
      subtype: "List",
      initialProperties: { orientation: "vertical" },
    });
    expect(currentRow()?.content).toBe("empty");

    useEditorStore.setState((state) => ({
      screenTrees: {
        ...state.screenTrees,
        [screenId]: {
          ...state.screenTrees[screenId],
          columns: state.screenTrees[screenId].columns.map((column) => ({
            ...column,
            properties: {},
          })),
        },
      },
    }));
    useEditorStore.getState().dropOnRow(rowId, {
      type: "Catalog",
      subtype: "List",
      initialProperties: { orientation: "vertical" },
    });
    expect(currentRow()).toMatchObject({ content: "component", weight: 1 });
    expect(currentRow()?.height).toBeUndefined();
  });});
