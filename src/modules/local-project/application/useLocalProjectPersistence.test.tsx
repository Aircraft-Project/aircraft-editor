import { act, renderHook, waitFor } from "@testing-library/react";
import { useTriggerGraphStore } from "@/modules/editor/application/useTriggerGraphStore";
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
});
