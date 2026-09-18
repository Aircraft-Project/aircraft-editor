import {
  InvalidSchemaSnapshotError,
  MockSchemaProvider,
  SchemaDefinitionNotFoundError,
} from ".";

const COMPONENT_TYPES = [
  "TextField",
  "Button",
  "Catalog",
  "TextLabel",
  "IMAGE",
  "ICON",
  "Fractal",
] as const;

const TRIGGER_TYPES = [
  "ApiService",
  "Math",
  "Conditional",
  "ConditionalPlus",
  "ConditionalSwitcher",
  "Navigation",
  "JsonBuilder",
  "JsonMapper",
  "JsonEngine",
  "Shooter",
  "FetchContextArg",
  "StateComp",
  "StringEngine",
] as const;

function createDataDrivenFixture(): unknown {
  return {
    manifest: {
      schemaVersion: "test-snapshot",
      source: "test",
      components: 1,
      triggers: 1,
    },
    index: {
      componentTypes: ["Checkbox"],
      triggerTypes: ["Pulse"],
    },
    components: [
      {
        type: "Checkbox",
        description: "Fixture component unknown to the provider implementation.",
        subtypes: ["Basic"],
        contexts: ["interface"],
        effectiveEvents: ["on-change-event"],
        properties: [
          {
            name: "checked",
            valueType: "boolean",
            required: false,
            default: false,
          },
        ],
      },
    ],
    triggers: [
      {
        type: "Pulse",
        description: "Fixture trigger unknown to the provider implementation.",
        requiredProperties: [
          {
            name: "duration",
            valueType: "int",
            required: true,
          },
        ],
        optionalProperties: [],
      },
    ],
    contexts: [
      {
        context: "interface",
        allowedComponentTypes: ["Checkbox"],
        supportsTriggers: true,
        supportsObservers: true,
      },
    ],
  };
}

describe("MockSchemaProvider", () => {
  const provider = new MockSchemaProvider();

  it("returns the versioned aircraft-android manifest", async () => {
    await expect(provider.getManifest()).resolves.toEqual(
      expect.objectContaining({
        schemaVersion: "snapshot-1",
        source: "aircraft-android",
        components: 7,
        triggers: 13,
      }),
    );
  });

  it("lists every component declared by the snapshot index", async () => {
    const components = await provider.listComponents();

    expect(components.map(({ type }) => type)).toEqual(COMPONENT_TYPES);
  });

  it("returns a complete component schema", async () => {
    const component = await provider.getComponent("Button");

    expect(component.subtypes).toEqual([
      {
        type: "Simple",
        description: "Standard text button. Only available subtype.",
      },
    ]);
    expect(component.properties).toEqual([
      expect.objectContaining({
        name: "label",
        valueType: { kind: "string", raw: "string" },
        required: true,
      }),
    ]);
  });

  it("fails explicitly for an unknown component", async () => {
    await expect(provider.getComponent("UNKNOWN")).rejects.toEqual(
      expect.objectContaining<Partial<SchemaDefinitionNotFoundError>>({
        code: "SCHEMA_DEFINITION_NOT_FOUND",
        definitionKind: "component",
        definitionType: "UNKNOWN",
      }),
    );
  });

  it("lists every trigger declared by the snapshot index", async () => {
    const triggers = await provider.listTriggers();

    expect(triggers.map(({ type }) => type)).toEqual(TRIGGER_TYPES);
  });

  it("returns required and optional trigger properties", async () => {
    const trigger = await provider.getTrigger("Navigation");

    expect(trigger.requiredProperties[0]).toEqual(
      expect.objectContaining({
        name: "type",
        valueType: {
          kind: "enum",
          raw: "enum:Navigate,Back,PopToRoot,PopTo",
        },
        options: ["Navigate", "Back", "PopToRoot", "PopTo"],
      }),
    );
    expect(trigger.optionalProperties.map(({ name }) => name)).toEqual([
      "target",
      "args",
    ]);
  });

  it("fails explicitly for an unknown trigger", async () => {
    await expect(provider.getTrigger("UNKNOWN")).rejects.toEqual(
      expect.objectContaining<Partial<SchemaDefinitionNotFoundError>>({
        code: "SCHEMA_DEFINITION_NOT_FOUND",
        definitionKind: "trigger",
        definitionType: "UNKNOWN",
      }),
    );
  });

  it("returns only effective events declared by each component", async () => {
    const buttonEvents = await provider.getEffectiveEvents("Button");
    const labelEvents = await provider.getEffectiveEvents("TextLabel");

    expect(buttonEvents.map(({ type }) => type)).toContain("on-clic-event");
    expect(labelEvents.map(({ type }) => type)).not.toContain("on-clic-event");
  });

  it("returns verified interface and catalog-item context rules", async () => {
    await expect(provider.getContextRules("interface")).resolves.toEqual({
      context: "interface",
      allowedComponentTypes: COMPONENT_TYPES,
      supportsTriggers: true,
      supportsObservers: true,
    });
    await expect(provider.getContextRules("catalog-item")).resolves.toEqual({
      context: "catalog-item",
      allowedComponentTypes: ["TextLabel", "IMAGE", "ICON"],
      supportsTriggers: false,
      supportsObservers: false,
    });
  });

  it("keeps manifest counts consistent with loaded definitions", async () => {
    const [manifest, components, triggers] = await Promise.all([
      provider.getManifest(),
      provider.listComponents(),
      provider.listTriggers(),
    ]);

    expect(manifest.components).toBe(components.length);
    expect(manifest.triggers).toBe(triggers.length);
  });

  it("contains no duplicate component or trigger types", async () => {
    const [components, triggers] = await Promise.all([
      provider.listComponents(),
      provider.listTriggers(),
    ]);
    const componentTypes = components.map(({ type }) => type);
    const triggerTypes = triggers.map(({ type }) => type);

    expect(new Set(componentTypes).size).toBe(componentTypes.length);
    expect(new Set(triggerTypes).size).toBe(triggerTypes.length);
  });

  it("normalizes arrays, maps, nested fields and variants generically", async () => {
    const catalog = await provider.getComponent("Catalog");
    const conditionalSwitcher = await provider.getTrigger(
      "ConditionalSwitcher",
    );

    expect(
      catalog.properties.find(({ name }) => name === "data")?.valueType,
    ).toEqual({
      kind: "map",
      raw: "map<string,string>",
      itemType: "string,string",
    });
    expect(
      catalog.properties.find(({ name }) => name === "carousel")?.fields,
    ).toHaveLength(2);
    const testsProperty = conditionalSwitcher.requiredProperties.find(
      ({ name }) => name === "tests",
    );
    const jumpStatement = testsProperty?.fields?.find(
      ({ name }) => name === "jumpStatement",
    );

    expect(jumpStatement?.variants).toHaveLength(3);
  });

  it("discovers arbitrary valid component and trigger data without provider cases", async () => {
    const dataDrivenProvider = new MockSchemaProvider(
      createDataDrivenFixture(),
    );

    await expect(dataDrivenProvider.listComponents()).resolves.toEqual([
      expect.objectContaining({ type: "Checkbox" }),
    ]);
    await expect(dataDrivenProvider.getComponent("Checkbox")).resolves.toEqual(
      expect.objectContaining({ type: "Checkbox" }),
    );
    await expect(dataDrivenProvider.listTriggers()).resolves.toEqual([
      expect.objectContaining({ type: "Pulse" }),
    ]);
    await expect(dataDrivenProvider.getTrigger("Pulse")).resolves.toEqual(
      expect.objectContaining({ type: "Pulse" }),
    );
  });

  it("rejects duplicate definition types while loading external data", () => {
    const fixture = createDataDrivenFixture();
    if (typeof fixture !== "object" || fixture === null) {
      throw new Error("Invalid test fixture.");
    }

    const duplicateFixture = {
      ...fixture,
      manifest: {
        schemaVersion: "test-snapshot",
        source: "test",
        components: 2,
        triggers: 1,
      },
      index: {
        componentTypes: ["Checkbox", "Checkbox"],
        triggerTypes: ["Pulse"],
      },
      components: [
        {
          type: "Checkbox",
          subtypes: ["Basic"],
          contexts: ["interface"],
          effectiveEvents: [],
          properties: [],
        },
        {
          type: "Checkbox",
          subtypes: ["Alternate"],
          contexts: ["interface"],
          effectiveEvents: [],
          properties: [],
        },
      ],
    };

    expect(() => new MockSchemaProvider(duplicateFixture)).toThrow(
      InvalidSchemaSnapshotError,
    );
  });
});

