"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";
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
import { useEditorStore } from "@/store/useEditorStore";
import styles from "./EditorView.module.css";

type EditorViewProps = {
  readonly projectId?: string;
  readonly onBackToProjects?: () => void;
  readonly schemaProvider?: SchemaProvider;
};

export function EditorView({
  projectId,
  onBackToProjects,
  schemaProvider = aircraftSchemaProvider,
}: EditorViewProps) {
  const projectName = projectId ?? "Mi aplicación";
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
  const { activeScreenId, screens, screenTrees } = useEditorStore();
  const activeScreen =
    screens.find((screen) => screen.id === activeScreenId) ?? screens[0];
  const activeBody = screenTrees[activeScreen.id];

  const returnPreviewFocus = useCallback(() => {
    previewButtonRef.current?.focus();
  }, []);

  return (
    <div className={styles.view}>
      <Topbar
        projectName={projectName}
        devicePresetId={devicePresetId}
        zoom={zoom}
        previewButtonRef={previewButtonRef}
        onBack={onBackToProjects}
        onDeviceChange={setDevicePresetId}
        onZoomChange={setZoom}
        onPreview={() => setPreviewOpen(true)}
        onSave={() =>
          setSaveAnnouncement(
            "Los cambios permanecen guardados localmente durante esta sesión.",
          )
        }
      />

      <div className={styles.body}>
        <EditorNavigation
          activeWorkspace={workspace}
          onChange={setWorkspace}
        />
        <section
          className={styles.workspace}
          aria-label={`Workspace ${workspace}`}
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
          {workspace === "resources" ? <ResourcesWorkspace /> : null}
        </section>
      </div>

      <p className={styles.announcement} aria-live="polite">
        {saveAnnouncement}
      </p>

      {previewOpen ? (
        <PreviewDialog
          body={activeBody}
          devicePresetId={devicePresetId}
          screenName={activeScreen.name}
          onClose={() => setPreviewOpen(false)}
          returnFocus={returnPreviewFocus}
        />
      ) : null}
    </div>
  );
}
