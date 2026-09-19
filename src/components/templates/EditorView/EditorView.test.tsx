import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ComponentSchema,
  ContextRules,
  SchemaProvider,
  TriggerSchema,
} from "@/modules/aircraft-schema";
import {
  useTriggerGraphStore,
} from "@/modules/editor";
import { useEditorStore } from "@/store/useEditorStore";
import { EditorView } from "./EditorView";

const components: readonly ComponentSchema[] = [
  {
    type: "ExperimentalWidget",
    description: "Future schema component",
    subtypes: [{ type: "Primary" }],
    contexts: ["interface"],
    properties: [
      {
        name: "caption",
        valueType: { kind: "string", raw: "string" },
        required: true,
        defaultValue: "Hello",
      },
    ],
    effectiveEvents: [{ type: "on-change-event" }],
  },
  {
    type: "TextLabel",
    subtypes: [{ type: "Label" }],
    contexts: ["interface", "catalog-item"],
    properties: [
      {
        name: "defaultText",
        valueType: { kind: "string", raw: "string" },
        required: false,
        defaultValue: "Text",
      },
    ],
    effectiveEvents: [{ type: "on-create-event" }],
  },
];

const triggers: readonly TriggerSchema[] = [
  {
    type: "Pulse",
    description: "Future schema trigger",
    requiredProperties: [
      {
        name: "duration",
        valueType: { kind: "integer", raw: "int" },
        required: true,
      },
    ],
    optionalProperties: [],
  },
];

const contexts: readonly ContextRules[] = [
  {
    context: "interface",
    allowedComponentTypes: ["ExperimentalWidget", "TextLabel"],
    supportsTriggers: true,
    supportsObservers: true,
  },
  {
    context: "catalog-item",
    allowedComponentTypes: ["TextLabel"],
    supportsTriggers: false,
    supportsObservers: false,
  },
];

function createProvider({
  failComponents = false,
  failContexts = false,
}: {
  failComponents?: boolean;
  failContexts?: boolean;
} = {}): SchemaProvider {
  return {
    getManifest: jest.fn(async () => ({
      schemaVersion: "test",
      source: "test",
      components: components.length,
      triggers: triggers.length,
    })),
    listComponents: jest.fn(async () => {
      if (failComponents) {
        throw new Error("catalog unavailable");
      }
      return components;
    }),
    getComponent: jest.fn(async (type) => {
      const component = components.find((item) => item.type === type);
      if (!component) throw new Error("missing component");
      return component;
    }),
    listTriggers: jest.fn(async () => triggers),
    getTrigger: jest.fn(async (type) => {
      const trigger = triggers.find((item) => item.type === type);
      if (!trigger) throw new Error("missing trigger");
      return trigger;
    }),
    getEffectiveEvents: jest.fn(async (type) => {
      const component = components.find((item) => item.type === type);
      if (!component) throw new Error("missing component");
      return component.effectiveEvents;
    }),
    listContexts: jest.fn(async () => {
      if (failContexts) {
        throw new Error("contexts unavailable");
      }
      return contexts;
    }),
    getContextRules: jest.fn(async (context) => {
      const rules = contexts.find((item) => item.context === context);
      if (!rules) throw new Error("missing context");
      return rules;
    }),
  };
}

describe("EditorView schema-driven workspaces", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useTriggerGraphStore.getState().reset();
  });

  it("navigates the four independent workspaces and discovers future definitions", async () => {
    const user = userEvent.setup();
    render(<EditorView schemaProvider={createProvider()} />);

    expect(
      await screen.findByText("ExperimentalWidget"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo Pantallas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    expect(screen.getByText("Módulo Pantallas")).toBeInTheDocument();
    expect(screen.queryByText("ExperimentalWidget")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Triggers" }));
    expect(screen.getByText("Módulo Triggers")).toBeInTheDocument();
    expect(screen.getByText("Pulse")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recursos" }));
    expect(screen.getByText("Módulo Recursos")).toBeInTheDocument();
  });

  it("adds a schema component without a component-specific UI case and renders its inspector", async () => {
    const user = userEvent.setup();
    const provider = createProvider();
    render(<EditorView schemaProvider={provider} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Agregar ExperimentalWidget al lienzo",
      }),
    );

    expect(await screen.findAllByText("Future schema component")).not.toHaveLength(0);
    expect(screen.getByLabelText("caption *")).toHaveValue("Hello");
    expect(provider.getComponent).toHaveBeenCalledWith(
      "ExperimentalWidget",
    );
  });

  it("shows only effective events from the selected component and discovers future triggers", async () => {
    const user = userEvent.setup();
    const provider = createProvider();
    render(<EditorView schemaProvider={provider} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Agregar ExperimentalWidget al lienzo",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Triggers" }));

    expect(await screen.findByText("Al cambiar")).toBeInTheDocument();
    expect(screen.queryByText("Al hacer clic")).not.toBeInTheDocument();
    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(provider.getEffectiveEvents).toHaveBeenCalledWith(
      "ExperimentalWidget",
    );
  });

  it("uses context rules to restrict catalog-item and disable triggers", async () => {
    const user = userEvent.setup();
    render(<EditorView schemaProvider={createProvider()} />);

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    await user.click(
      screen.getByRole("button", { name: "Nueva pantalla" }),
    );
    await user.type(screen.getByLabelText("Nombre"), "Item");
    await user.selectOptions(
      screen.getByLabelText("Tipo de pantalla"),
      "catalog-item",
    );
    await user.click(
      screen.getByRole("button", { name: "Crear pantalla" }),
    );
    await user.click(screen.getByRole("button", { name: "Componentes" }));

    expect(await screen.findByText("Etiqueta de texto")).toBeInTheDocument();
    expect(screen.queryByText("ExperimentalWidget")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Triggers" }));
    expect(screen.getByText("Triggers no disponibles")).toBeInTheDocument();
  });

  it("changes device and opens an accessible blocking preview dialog", async () => {
    const user = userEvent.setup();
    render(<EditorView schemaProvider={createProvider()} />);

    await screen.findByText("ExperimentalWidget");
    await user.selectOptions(
      screen.getByLabelText("Dispositivo"),
      "pixel-8",
    );
    expect(screen.getByLabelText("Dispositivo")).toHaveValue("pixel-8");

    await user.click(
      screen.getByRole("button", { name: "Vista previa" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Vista previa" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await user.click(
      screen.getByRole("button", { name: "Cerrar vista previa" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("creates and selects a screen using local Editor state", async () => {
    const user = userEvent.setup();
    render(<EditorView schemaProvider={createProvider()} />);

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    await user.click(
      screen.getByRole("button", { name: "Nueva pantalla" }),
    );
    await user.type(screen.getByLabelText("Nombre"), "Detalle");
    await user.type(
      screen.getByLabelText("Descripción opcional"),
      "Información del producto",
    );
    await user.click(
      screen.getByRole("button", { name: "Crear pantalla" }),
    );

    expect(screen.getByDisplayValue("Detalle")).toBeInTheDocument();
    expect(useEditorStore.getState().activeScreenId).not.toBe("home");
  });

  it("keeps the exact screen name entered by the user", async () => {
    const user = userEvent.setup();
    render(<EditorView schemaProvider={createProvider()} />);

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    const nameInput = await screen.findByLabelText("Nombre");
    await user.clear(nameInput);
    await user.type(nameInput, "Inicio personalizado");

    expect(nameInput).toHaveValue("Inicio personalizado");
    expect(
      screen.queryByRole("button", { name: "Renombrar" }),
    ).not.toBeInTheDocument();
    expect(useEditorStore.getState().screens[0].name).toBe(
      "Inicio personalizado",
    );
  });

  it("disables screen creation until contexts are loaded", async () => {
    const user = userEvent.setup();
    let resolveContexts:
      | ((value: readonly ContextRules[]) => void)
      | undefined;
    const provider = createProvider();
    provider.listContexts = jest.fn(
      () =>
        new Promise<readonly ContextRules[]>((resolve) => {
          resolveContexts = resolve;
        }),
    );
    render(<EditorView schemaProvider={provider} />);

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    await user.click(
      screen.getByRole("button", { name: "Nueva pantalla" }),
    );
    const createButton = screen.getByRole("button", {
      name: "Crear pantalla",
    });
    expect(createButton).toBeDisabled();

    resolveContexts?.(contexts);
    await waitFor(() => expect(createButton).toBeEnabled());
  });

  it("keeps screen creation disabled when contexts fail", async () => {
    const user = userEvent.setup();
    render(
      <EditorView
        schemaProvider={createProvider({ failContexts: true })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pantallas" }));
    await user.click(
      screen.getByRole("button", { name: "Nueva pantalla" }),
    );

    expect(
      await screen.findByText("No fue posible cargar los contextos."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear pantalla" }),
    ).toBeDisabled();
  });
  it("shows a retryable local schema error without breaking the Editor shell", async () => {
    render(
      <EditorView
        projectId="project-test"
        schemaProvider={createProvider({ failComponents: true })}
      />,
    );

    expect(
      await screen.findByText("No fue posible cargar los componentes."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Aircraft Editor")).not.toHaveLength(0);
  });
});
