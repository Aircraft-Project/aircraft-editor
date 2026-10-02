"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultDevicePresetId,
} from "@/components/organisms/LayoutCanvas/devicePresets";
import { Topbar } from "@/components/organisms";
import {
  aircraftSchemaProvider,
  type SchemaProvider,
} from "@/modules/aircraft-schema";
import {
  ComponentsWorkspace,
  DEFAULT_EDITOR_WORKSPACE,
  EditorNavigation,
  type EditorWorkspace,
  PreviewDialog,
  ResourcesWorkspace,
  ScreensWorkspace,
  TriggersWorkspace,
} from "@/modules/editor";
import {
  getResourceRepository,
  type ProjectSource,
  useLocalProjectPersistence,
} from "@/modules/local-project";
import { getSession } from "@/modules/session";
import { AircraftLoadingOverlay } from "@/shared/ui";
import { useEditorStore } from "@/store/useEditorStore";
import styles from "./EditorView.module.css";

type EditorViewProps = {
  readonly projectId?: string;
  readonly source?: ProjectSource;
  readonly onBackToProjects?: () => void;
  readonly schemaProvider?: SchemaProvider;
};

export function EditorView({
  projectId,
  source = "CLOUD",
  onBackToProjects,
  schemaProvider = aircraftSchemaProvider,
}: EditorViewProps) {
  const [workspace, setWorkspace] = useState<EditorWorkspace>(
    DEFAULT_EDITOR_WORKSPACE,
  );
  const [devicePresetId, setDevicePresetId] = useState(
    defaultDevicePresetId,
  );
  const [zoom, setZoom] = useState(100);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const {
    activeScreenId,
    screens,
    screenTrees,
    catalogItems,
    activeCatalogItemId,
  } = useEditorStore();
  const [catalogTriggerRules, setCatalogTriggerRules] = useState<{
    readonly key: string;
    readonly supportsTriggers: boolean;
  } | null>(null);

  const {
    saveState,
    projectName: persistedProjectName,
    isHydrating,
    loadError,
    flush,
  } = useLocalProjectPersistence({
    projectId,
    source,
    workspace,
    devicePresetId,
    zoom,
    setWorkspace,
    setDevicePresetId,
    setZoom,
  });

  const projectName =
    persistedProjectName ?? projectId ?? "Mi aplicación";
  const activeScreen =
    screens.find((screen) => screen.id === activeScreenId) ?? screens[0];
  const activeBody = activeScreen
    ? screenTrees[activeScreen.id]
    : undefined;

  const activeCatalogItem = catalogItems.find(
    (item) => item.id === activeCatalogItemId,
  );
  const activeCatalogContext = activeCatalogItem?.context ?? null;
  const catalogRulesKey = activeCatalogItem
    ? activeCatalogItem.id + "\0" + activeCatalogContext
    : null;
  const catalogSupportsTriggers =
    catalogRulesKey && catalogTriggerRules?.key === catalogRulesKey
      ? catalogTriggerRules.supportsTriggers
      : null;

  useEffect(() => {
    if (!activeCatalogContext || !catalogRulesKey) return;
    let current = true;
    schemaProvider
      .getContextRules(activeCatalogContext)
      .then((rules) => {
        if (current) {
          setCatalogTriggerRules({
            key: catalogRulesKey,
            supportsTriggers: rules.supportsTriggers,
          });
        }
      })
      .catch(() => {
        if (current) {
          setCatalogTriggerRules({
            key: catalogRulesKey,
            supportsTriggers: false,
          });
        }
      });
    return () => {
      current = false;
    };
  }, [activeCatalogContext, catalogRulesKey, schemaProvider]);

  const returnPreviewFocus = useCallback(() => {
    previewButtonRef.current?.focus();
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await flush();
      setSaveAnnouncement("Todos los cambios locales están guardados.");
    } catch {
      setSaveAnnouncement(
        "No fue posible guardar los últimos cambios. Inténtalo nuevamente.",
      );
    }
  }, [flush]);

  const handleBack = useCallback(async (): Promise<void> => {
    try {
      await flush();
      onBackToProjects?.();
    } catch {
      setSaveAnnouncement(
        "No fue posible guardar. Reintenta antes de salir del proyecto.",
      );
    }
  }, [flush, onBackToProjects]);

  const session = getSession();

  return (
    <div className={styles.view}>
      <Topbar
        projectName={projectName}
        devicePresetId={devicePresetId}
        zoom={zoom}
        saveState={source === "LOCAL" ? saveState : undefined}
        previewButtonRef={previewButtonRef}
        onBack={onBackToProjects ? () => void handleBack() : undefined}
        onDeviceChange={setDevicePresetId}
        onZoomChange={setZoom}
        onPreview={() => setPreviewOpen(true)}
        onSave={source === "LOCAL" ? () => void handleSave() : undefined}
      />

      {loadError ? (
        <div role="alert" className={styles.announcement}>
          {loadError}
        </div>
      ) : null}

      <div className={styles.body}>
        <EditorNavigation
          activeWorkspace={workspace}
          onChange={setWorkspace}
          disabledWorkspaces={
            activeCatalogItemId && catalogSupportsTriggers !== true
              ? ["triggers"]
              : []
          }
        />
        <section
          className={styles.workspace}
          aria-label={"Workspace " + workspace}
        >
          {workspace === "components" ? (
            <ComponentsWorkspace
              provider={schemaProvider}
              devicePresetId={devicePresetId}
              zoom={zoom}
              onOpenTriggers={() => setWorkspace("triggers")}
            />
          ) : null}
          {workspace === "screens" ? (
            <ScreensWorkspace
              provider={schemaProvider}
              devicePresetId={devicePresetId}
            />
          ) : null}
          {workspace === "triggers" ? (
            <TriggersWorkspace provider={schemaProvider} />
          ) : null}
          {workspace === "resources" ? (
            <ResourcesWorkspace
              ownerId={source === "LOCAL" ? session?.user.id : undefined}
              projectId={source === "LOCAL" ? projectId : undefined}
              repository={getResourceRepository()}
            />
          ) : null}
        </section>
      </div>

      <p className={styles.announcement} aria-live="polite">
        {saveAnnouncement}
      </p>

      {previewOpen && activeScreen && activeBody ? (
        <PreviewDialog
          body={activeBody}
          devicePresetId={devicePresetId}
          screenName={activeScreen.name}
          onClose={() => setPreviewOpen(false)}
          returnFocus={returnPreviewFocus}
        />
      ) : null}

      <AircraftLoadingOverlay
        open={isHydrating}
        title="Abriendo proyecto local..."
        description="Recuperando tus pantallas y recursos."
      />
    </div>
  );
}
