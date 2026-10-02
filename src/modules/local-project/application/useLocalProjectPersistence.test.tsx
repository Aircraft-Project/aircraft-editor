import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createTriggerBindingKey,
  useTriggerGraphStore,
} from "@/modules/editor/application/useTriggerGraphStore";
import {
  clearSession,
  setSession,
  type AuthSession,
} from "@/modules/session";
import { useEditorStore } from "@/store/useEditorStore";
import { InMemoryLocalProjectRepository } from "../infrastructure/InMemoryLocalProjectRepository";
import { useLocalProjectPersistence } from "./useLocalProjectPersistence";

const session: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

describe("useLocalProjectPersistence", () => {
  beforeEach(() => {
    clearSession();
    setSession(session);
    useEditorStore.getState().resetEditor();
    useTriggerGraphStore.getState().reset();
  });

  afterEach(() => {
    clearSession();
    useEditorStore.getState().resetEditor();
    useTriggerGraphStore.getState().reset();
  });

  it("hydrates, autosaves a layout change and restores it on a later load", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await repository.create({
      ownerId: session.user.id,
      name: "Hydration Project",
      schemaVersion: "snapshot-1",
    });
    const projectId = project.manifest.projectId;
    const screenId = project.screens[0].screenId;
    const componentId = "5555555555555555";
    const triggerId = "6666666666666666";
    const bindingKey = createTriggerBindingKey(screenId, componentId, "onClick");
    await repository.saveScreen(session.user.id, projectId, {
      ...project.screens[0],
      mcpMetadata: { source: "assembler" },
      extensions: { futureScreen: "preserve" },
    });
    await repository.saveLayout(session.user.id, projectId, {
      ...project.layouts[screenId],
      tree: {
        ...project.layouts[screenId].tree,
        mcpMetadata: { body: "keep" },
        extensions: { futureBody: "keep" },
        columns: [
          {
            ...project.layouts[screenId].tree.columns[0],
            mcpMetadata: { column: "keep" },
            extensions: { futureColumn: true },
            rows: [
              {
                id: "4444444444444444",
                kind: "row",
                content: "component",
                height: "wrap_content",
                properties: {},
                mcpMetadata: { row: "keep" },
                extensions: { futureRow: 1 },
                component: {
                  id: componentId,
                  kind: "component",
                  type: "Button",
                  subtype: "Primary",
                  name: "Continue",
                  properties: { text: "Continue" },
                  observers: [{ observerIdentifier: "observer-a" }],
                  mcpMetadata: { component: "keep" },
                  extensions: { futureComponent: "keep" },
                },
              },
            ],
          },
        ],
      },
      extensions: { futureLayout: "preserve" },
    });
    await repository.saveTriggerGraphs(session.user.id, projectId, {
      documentVersion: 1,
      screenId,
      graphs: {
        [bindingKey]: {
          rootVertexId: triggerId,
          nodes: [
            {
              id: triggerId,
              kind: "trigger",
              type: "Conditional",
              label: "Conditional",
              properties: {},
              mcpMetadata: { trigger: "keep" },
            },
          ],
          edges: [
            {
              id: "edge-self",
              source: triggerId,
              target: triggerId,
            },
          ],
          selectedNodeId: triggerId,
          mcpMetadata: { graph: "keep" },
          extensions: { futureBinding: "preserve" },
        },
      },
      extensions: { futureGraphDocument: "preserve" },
    });
    await repository.saveSettings(session.user.id, projectId, {
      ...project.settings,
      extensions: { futureSettings: "preserve" },
    });
    const saveLayout = jest.spyOn(repository, "saveLayout");
    const setWorkspace = jest.fn();
    const setDevicePresetId = jest.fn();
    const setZoom = jest.fn();

    const first = renderHook(() =>
      useLocalProjectPersistence({
        projectId,
        source: "LOCAL",
        workspace: "components",
        devicePresetId: "iphone-15",
        zoom: 100,
        setWorkspace,
        setDevicePresetId,
        setZoom,
        repository,
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(first.result.current.isHydrating).toBe(false));
    expect(first.result.current.loadError).toBeNull();
    expect(useEditorStore.getState().activeScreenId).toBe(screenId);

    act(() => {
      useEditorStore.setState((state) => ({
        screenTrees: {
          ...state.screenTrees,
          [screenId]: {
            ...state.screenTrees[screenId],
            id: "persisted-layout-body",
          },
        },
      }));
    });

    await waitFor(() => expect(saveLayout).toHaveBeenCalledTimes(1));
    await act(async () => first.result.current.flush());
    const saved = await repository.load(session.user.id, projectId);
    expect(saved.layouts[screenId].tree.id).toBe("persisted-layout-body");
    const savedComponent =
      saved.layouts[screenId].tree.columns[0].rows[0].content === "component"
        ? saved.layouts[screenId].tree.columns[0].rows[0].component
        : null;
    expect(savedComponent?.observers).toEqual([
      { observerIdentifier: "observer-a" },
    ]);
    expect(savedComponent?.mcpMetadata).toEqual({ component: "keep" });
    expect(saved.layouts[screenId].tree.mcpMetadata).toEqual({ body: "keep" });
    expect(saved.layouts[screenId].extensions).toEqual({
      futureLayout: "preserve",
    });
    expect(saved.triggerGraphs[screenId].extensions).toEqual({
      futureGraphDocument: "preserve",
    });
    expect(saved.triggerGraphs[screenId].graphs[bindingKey]).toMatchObject({
      rootVertexId: triggerId,
      mcpMetadata: { graph: "keep" },
      extensions: { futureBinding: "preserve" },
    });
    expect(
      saved.triggerGraphs[screenId].graphs[bindingKey].nodes[0].mcpMetadata,
    ).toEqual({ trigger: "keep" });
    expect(saved.settings.extensions).toEqual({
      futureSettings: "preserve",
    });
    expect(saved.screens[0].extensions).toEqual({
      futureScreen: "preserve",
    });
    first.unmount();

    act(() => {
      useEditorStore.getState().resetEditor();
      useTriggerGraphStore.getState().reset();
    });

    const second = renderHook(() =>
      useLocalProjectPersistence({
        projectId,
        source: "LOCAL",
        workspace: "components",
        devicePresetId: "iphone-15",
        zoom: 100,
        setWorkspace,
        setDevicePresetId,
        setZoom,
        repository,
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(second.result.current.isHydrating).toBe(false));
    expect(useEditorStore.getState().screenTrees[screenId].id).toBe(
      "persisted-layout-body",
    );
    second.unmount();
  });

  it("autosaves catalog items granularly without rewriting theme", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await repository.create({
      ownerId: session.user.id,
      name: "Catalog Project",
      schemaVersion: "snapshot-1",
    });
    const projectId = project.manifest.projectId;
    await repository.saveCatalogItem(session.user.id, projectId, {
      documentVersion: 1,
      catalogItemId: "movie-card",
      name: "movie-card",
      destination: "movie-card",
      context: "catalog-item",
      layout: {
        ...project.layouts[project.screens[0].screenId].tree,
        id: "catalog-body",
      },
    });
    await repository.saveTheme(session.user.id, projectId, {
      documentVersion: 1,
      projectId,
      theme: { colors: { primary: "00CFFF" } },
      componentTheme: {},
    });
    const saveCatalogItem = jest.spyOn(repository, "saveCatalogItem");
    const saveTheme = jest.spyOn(repository, "saveTheme");
    const setWorkspace = jest.fn();
    const setDevicePresetId = jest.fn();
    const setZoom = jest.fn();
    const view = renderHook(() =>
      useLocalProjectPersistence({
        projectId,
        source: "LOCAL",
        workspace: "components",
        devicePresetId: "iphone-15",
        zoom: 100,
        setWorkspace,
        setDevicePresetId,
        setZoom,
        repository,
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(view.result.current.isHydrating).toBe(false));
    await waitFor(() =>
      expect(useEditorStore.getState().catalogItems).toHaveLength(1),
    );
    act(() => {
      useEditorStore.setState((state) => ({
        catalogItems: state.catalogItems.map((item) =>
          item.id === "movie-card"
            ? {
                ...item,
                layout: { ...item.layout, id: "catalog-body-updated" },
              }
            : item,
        ),
      }));
    });
    await act(async () => view.result.current.flush());
    expect(saveCatalogItem).toHaveBeenCalledTimes(1);
    const loaded = await repository.load(session.user.id, projectId);
    expect(loaded.catalogItems[0].layout.id).toBe("catalog-body-updated");
    expect(loaded.theme.theme).toEqual({
      colors: { primary: "00CFFF" },
    });
    expect(saveTheme).not.toHaveBeenCalled();
    view.unmount();
  });
});
