"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorWorkspace } from "@/modules/editor";
import { useTriggerGraphStore } from "@/modules/editor/application/useTriggerGraphStore";
import { getSession } from "@/modules/session";
import { useEditorStore } from "@/store/useEditorStore";
import {
  DOCUMENT_VERSION,
  type ProjectSource,
  type ProjectSettingsDocument,
} from "../domain";
import { getLocalProjectRepository } from "../composition";
import { AutosaveCoordinator, type SaveState } from "./AutosaveCoordinator";
import {
  createLayoutDocument,
  createScreenDocuments,
  createTriggerGraphDocument,
  projectToEditorState,
} from "./projectMapper";
import { registerActiveProjectFlush } from "./activeProjectPersistence";
import type { LocalProjectRepository } from "./repositories";

interface UseLocalProjectPersistenceOptions {
  readonly projectId?: string;
  readonly source?: ProjectSource;
  readonly workspace: EditorWorkspace;
  readonly devicePresetId: string;
  readonly zoom: number;
  readonly setWorkspace: (workspace: EditorWorkspace) => void;
  readonly setDevicePresetId: (device: string) => void;
  readonly setZoom: (zoom: number) => void;
  readonly repository?: LocalProjectRepository;
  readonly debounceMs?: number;
}

type HydrationResult =
  | {
      readonly key: string;
      readonly status: "READY";
      readonly projectName: string;
    }
  | { readonly key: string; readonly status: "ERROR" };

export function useLocalProjectPersistence({
  projectId,
  source = "CLOUD",
  workspace,
  devicePresetId,
  zoom,
  setWorkspace,
  setDevicePresetId,
  setZoom,
  repository = getLocalProjectRepository(),
  debounceMs,
}: UseLocalProjectPersistenceOptions) {
  const [saveState, setSaveState] = useState<SaveState>("SAVED");
  const [hydration, setHydration] = useState<HydrationResult | null>(null);
  const coordinatorRef = useRef<AutosaveCoordinator | null>(null);
  const hydratingRef = useRef(source === "LOCAL");
  const ownerIdRef = useRef<string | null>(null);
  const persistedSettingsRef = useRef<string | null>(null);
  const activeScreenId = useEditorStore((state) => state.activeScreenId);
  const hydrationKey = source + ":" + (projectId ?? "");
  const localProjectRequested = source === "LOCAL" && Boolean(projectId);
  const isHydrating = localProjectRequested && hydration?.key !== hydrationKey;
  const loadError =
    hydration?.key === hydrationKey && hydration.status === "ERROR"
      ? "No fue posible abrir el proyecto local."
      : null;
  const projectName =
    hydration?.key === hydrationKey && hydration.status === "READY"
      ? hydration.projectName
      : null;

  useEffect(() => {
    if (source !== "LOCAL" || !projectId) {
      hydratingRef.current = false;
      ownerIdRef.current = null;
      persistedSettingsRef.current = null;
      return;
    }
    const session = getSession();
    if (!session) {
      hydratingRef.current = false;
      let current = true;
      queueMicrotask(() => {
        if (current) {
          setHydration({ key: hydrationKey, status: "ERROR" });
        }
      });
      return () => {
        current = false;
      };
    }

    let current = true;
    let unregisterFlush: () => void = () => undefined;
    hydratingRef.current = true;
    const coordinator = new AutosaveCoordinator({
      debounceMs,
      onStateChange: (state) => {
        if (current) setSaveState(state);
      },
    });
    coordinatorRef.current = coordinator;
    ownerIdRef.current = session.user.id;
    persistedSettingsRef.current = null;

    repository
      .load(session.user.id, projectId)
      .then((project) => {
        if (!current) return;
        const hydrated = projectToEditorState(project);
        useEditorStore.getState().hydrateEditor(hydrated);
        useTriggerGraphStore.getState().hydrateGraphs(hydrated.graphs);
        persistedSettingsRef.current = settingsSignature(project.settings);
        setWorkspace(project.settings.activeWorkspace);
        setDevicePresetId(project.settings.selectedDevice);
        setZoom(project.settings.zoom);
        hydratingRef.current = false;
        setHydration({
          key: hydrationKey,
          status: "READY",
          projectName: project.metadata.name,
        });
        unregisterFlush = registerActiveProjectFlush(() =>
          coordinator.flush(),
        );
      })
      .catch(() => {
        if (!current) return;
        hydratingRef.current = false;
        setHydration({ key: hydrationKey, status: "ERROR" });
      });

    return () => {
      current = false;
      unregisterFlush();
      void coordinator.flush().catch(() => undefined);
      coordinator.dispose();
      if (coordinatorRef.current === coordinator) {
        coordinatorRef.current = null;
      }
      ownerIdRef.current = null;
      persistedSettingsRef.current = null;
    };
  }, [
    debounceMs,
    hydrationKey,
    projectId,
    repository,
    setDevicePresetId,
    setWorkspace,
    setZoom,
    source,
  ]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    const coordinator = coordinatorRef.current;
    if (
      source !== "LOCAL" ||
      !projectId ||
      isHydrating ||
      loadError ||
      !ownerId ||
      !coordinator
    ) {
      return;
    }

    let previousScreenIds = new Set(
      useEditorStore.getState().screens.map((screen) => screen.id),
    );
    const unsubscribeEditor = useEditorStore.subscribe((state, previous) => {
      if (hydratingRef.current) return;

      if (
        state.screens !== previous.screens ||
        state.initialScreenId !== previous.initialScreenId
      ) {
        const documents = createScreenDocuments(
          state.screens,
          state.initialScreenId,
        );
        const currentIds = new Set(
          documents.map((document) => document.screenId),
        );
        for (const document of documents) {
          coordinator.schedule("screen:" + document.screenId, () =>
            repository.saveScreen(ownerId, projectId, document),
          );
        }
        for (const removedId of previousScreenIds) {
          if (!currentIds.has(removedId)) {
            coordinator.schedule("screen:" + removedId, () =>
              repository.deleteScreen(ownerId, projectId, removedId),
            );
          }
        }
        previousScreenIds = currentIds;
      }

      if (state.screenTrees !== previous.screenTrees) {
        for (const [screenId, tree] of Object.entries(state.screenTrees)) {
          if (tree !== previous.screenTrees[screenId]) {
            const document = createLayoutDocument(screenId, tree);
            coordinator.schedule("layout:" + screenId, () =>
              repository.saveLayout(ownerId, projectId, document),
            );
          }
        }
      }
    });

    const unsubscribeGraphs = useTriggerGraphStore.subscribe(
      (state, previous) => {
        if (hydratingRef.current || state.graphs === previous.graphs) {
          return;
        }
        const screenIds = new Set(
          useEditorStore.getState().screens.map((screen) => screen.id),
        );
        for (const screenId of screenIds) {
          const document = createTriggerGraphDocument(screenId, state.graphs);
          coordinator.schedule("graphs:" + screenId, () =>
            repository.saveTriggerGraphs(ownerId, projectId, document),
          );
        }
      },
    );

    return () => {
      unsubscribeEditor();
      unsubscribeGraphs();
    };
  }, [isHydrating, loadError, projectId, repository, source]);
  useEffect(() => {
    const ownerId = ownerIdRef.current;
    if (
      source !== "LOCAL" ||
      !projectId ||
      isHydrating ||
      loadError ||
      hydratingRef.current ||
      !ownerId
    ) {
      return;
    }
    const document: ProjectSettingsDocument = {
      documentVersion: DOCUMENT_VERSION,
      projectId,
      activeScreenId: useEditorStore.getState().activeScreenId,
      activeWorkspace: workspace,
      selectedDevice: devicePresetId,
      zoom,
    };
    const signature = settingsSignature(document);
    if (persistedSettingsRef.current === signature) return;
    persistedSettingsRef.current = signature;
    coordinatorRef.current?.schedule("settings", () =>
      repository.saveSettings(ownerId, projectId, document),
    );
  }, [
    activeScreenId,
    devicePresetId,
    isHydrating,
    loadError,
    projectId,
    repository,
    source,
    workspace,
    zoom,
  ]);

  return {
    saveState,
    projectName,
    isHydrating,
    loadError,
    flush: () => coordinatorRef.current?.flush() ?? Promise.resolve(),
  };
}
function settingsSignature(document: ProjectSettingsDocument): string {
  return [
    document.activeScreenId,
    document.activeWorkspace,
    document.selectedDevice,
    document.zoom,
  ].join("\0");
}
