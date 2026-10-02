import {
  cloneBody,
  collectLayoutIdentifiers,
  createColumnNode,
  createComponentNode,
  createEmptyBody,
  createRowNode,
  findRow,
  isAircraftIdentifier,
  updateColumnDeep,
  updateRowDeep,
} from "./layoutTree";

describe("layoutTree compatibility", () => {
  it("preserves structural properties through immutable updates and cloning", () => {
    const component = createComponentNode("Button", "primary", 1, {
      text: "Continue",
    });
    const row = {
      ...createRowNode([component]),
      height: 250 as const,
      properties: { semanticRole: "hero", spacing: 8 },
    };
    const column = {
      ...createColumnNode(),
      properties: { alignment: "center" },
      rows: [row],
    };
    const body = {
      ...createEmptyBody(),
      properties: { background: "navy" },
      columns: [column],
    };

    const updated = updateColumnDeep(body, column.id, (current) => ({
      ...current,
      properties: { ...current.properties, padding: 4 },
    }));
    const withUpdatedRow = updateRowDeep(updated, row.id, (current) => ({
      ...current,
      properties: { ...current.properties, spacing: 8 },
    }));
    const cloned = cloneBody(withUpdatedRow);

    expect(withUpdatedRow.properties).toEqual({ background: "navy" });
    expect(withUpdatedRow.columns[0].properties).toEqual({
      alignment: "center",
      padding: 4,
    });
    expect(findRow(withUpdatedRow, row.id)).toMatchObject({
      height: 250,
      properties: { semanticRole: "hero" },
    });
    expect(cloned.properties).toEqual(body.properties);
    expect(cloned.properties).not.toBe(body.properties);
    expect(cloned.columns[0].properties).toEqual(
      withUpdatedRow.columns[0].properties,
    );
    expect(cloned.columns[0].properties).not.toBe(column.properties);
    expect(cloned.columns[0].rows[0].properties).toEqual(row.properties);
    expect(cloned.columns[0].rows[0].properties).not.toBe(row.properties);
    expect(cloned.columns[0].rows[0].properties).not.toHaveProperty("height");
  });

  it.each(["wrap_content", "match_parent", 250] as const)(
    "preserves supported row height %s",
    (height) => {
      const row = { ...createRowNode([]), height };
      const body = {
        ...createEmptyBody(),
        columns: [{ ...createColumnNode(), rows: [row] }],
      };

      expect(findRow(body, row.id)?.height).toBe(height);
    },
  );

  it("generates collision-safe Aircraft semantic identifier shapes", () => {
    const body = createEmptyBody();
    const component = createComponentNode("Button", "Primary", 1);
    body.columns[0].rows = [createRowNode([component])];

    const identifiers = collectLayoutIdentifiers(body);
    expect(identifiers.size).toBe(4);
    expect([...identifiers].every(isAircraftIdentifier)).toBe(true);
  });});
