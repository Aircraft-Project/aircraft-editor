import { MockSchemaProvider } from ".";

describe("SchemaProvider contexts", () => {
  it("lists every context declared by data and preserves current rules", async () => {
    const source = {
      manifest: {
        schemaVersion: "test-contexts",
        source: "test",
        components: 0,
        triggers: 0,
      },
      index: { componentTypes: [], triggerTypes: [] },
      components: [],
      triggers: [],
      contexts: [
        {
          context: "future-context",
          allowedComponentTypes: [],
          supportsTriggers: false,
          supportsObservers: true,
        },
      ],
    };
    const dataDrivenProvider = new MockSchemaProvider(source);

    await expect(dataDrivenProvider.listContexts()).resolves.toEqual([
      expect.objectContaining({ context: "future-context" }),
    ]);

    const provider = new MockSchemaProvider();
    const contexts = await provider.listContexts();

    expect(contexts.map(({ context }) => context)).toEqual([
      "interface",
      "catalog-item",
    ]);
    await expect(provider.getContextRules("catalog-item")).resolves.toEqual({
      context: "catalog-item",
      allowedComponentTypes: ["TextLabel", "IMAGE", "ICON"],
      supportsTriggers: false,
      supportsObservers: false,
    });
  });
});
