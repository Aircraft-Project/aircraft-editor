"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Inspector, LayoutCanvas } from "@/components/organisms";
import type {
  ComponentSchema,
  ContextRules,
  SchemaProvider,
} from "@/modules/aircraft-schema";
import { findColumn, findComponent, findRow } from "@/modules/screens/layoutTree";
import { useEditorStore } from "@/store/useEditorStore";
import { ComponentsCatalog } from "./ComponentsCatalog";
import { DynamicComponentInspector } from "./DynamicComponentInspector";
import styles from "./ComponentsWorkspace.module.css";

interface ComponentsWorkspaceProps {
  readonly provider: SchemaProvider;
  readonly devicePresetId: string;
  readonly zoom: number;
  readonly onOpenTriggers: () => void;
}

export function ComponentsWorkspace({
  provider,
  devicePresetId,
  zoom,
  onOpenTriggers,
}: ComponentsWorkspaceProps) {
  const {
    activeScreenId,
    screens,
    screenTrees,
    selection,
    selectComponent,
    selectRow,
    selectColumn,
    addColumn,
    addColumnToRow,
    removeColumn,
    setColumnWeight,
    removeRow,
    setRowWeight,
    setRowHeight,
    renameComponent,
    setComponentProperty,
    dropOnColumn,
    dropOnRow,
    openTriggerGraph,
  } = useEditorStore();
  const body = screenTrees[activeScreenId];
  const activeScreen = screens.find((screen) => screen.id === activeScreenId);
  const [schemas, setSchemas] = useState<readonly ComponentSchema[]>([]);
  const [contextRules, setContextRules] = useState<ContextRules | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setStatus("loading");
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let current = true;
    const context = activeScreen?.context ?? "interface";
    Promise.all([
      provider.listComponents(),
      provider.getContextRules(context),
    ])
      .then(async ([definitions, rules]) => {
        const allowed = new Set(rules.allowedComponentTypes);
        const complete = await Promise.all(
          definitions
            .filter((definition) => allowed.has(definition.type))
            .map((definition) => provider.getComponent(definition.type)),
        );
        if (!current) return;
        setSchemas(complete);
        setContextRules(rules);
        setStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [activeScreen?.context, provider, revision]);

  const selectedComponent = useMemo(
    () =>
      selection?.kind === "component"
        ? findComponent(body, selection.id) ?? null
        : null,
    [body, selection],
  );

  const structuralInspector = useMemo(() => {
    if (selection?.kind === "row") {
      const row = findRow(body, selection.id);
      if (row) {
        return (
          <Inspector
            state="row"
            data={{ id: row.id, weight: row.weight, height: row.height }}
            onWeightChange={(weight) => setRowWeight(row.id, weight)}
            onHeightChange={(height) => setRowHeight(row.id, height)}
          />
        );
      }
    }
    if (selection?.kind === "column") {
      const column = findColumn(body, selection.id);
      if (column) {
        return (
          <Inspector
            state="column"
            data={{ id: column.id, weight: column.weight }}
            onWeightChange={(weight) => setColumnWeight(column.id, weight)}
          />
        );
      }
    }
    return null;
  }, [
    body,
    selection,
    setColumnWeight,
    setRowHeight,
    setRowWeight,
  ]);

  if (status === "loading") {
    return (
      <div className={styles.workspaceState} role="status">
        Cargando catálogo de componentes...
      </div>
    );
  }

  if (status === "error" || !contextRules) {
    return (
      <div className={styles.workspaceState} role="alert">
        <AlertCircle size={24} />
        <strong>No fue posible cargar los componentes.</strong>
        <button type="button" onClick={retry}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <ComponentsCatalog
        schemas={schemas}
        onAdd={(item) => dropOnColumn(body.columns[0].id, item)}
      />
      <main className={styles.canvasRegion}>
        <LayoutCanvas
          body={body}
          devicePresetId={devicePresetId}
          zoom={zoom}
          selection={selection}
          onSelectComponent={selectComponent}
          onSelectRow={selectRow}
          onSelectColumn={selectColumn}
          onAddColumn={addColumn}
          onAddColumnToRow={addColumnToRow}
          onRemoveColumn={removeColumn}
          onRemoveRow={removeRow}
          onDropOnColumn={dropOnColumn}
          onDropOnRow={dropOnRow}
        />
      </main>
      {selectedComponent ? (
        <DynamicComponentInspector
          component={selectedComponent}
          contextRules={contextRules}
          provider={provider}
          onRename={(name) => renameComponent(selectedComponent.id, name)}
          onPropertyChange={(property, value) =>
            setComponentProperty(selectedComponent.id, property, value)
          }
          onSelectEvent={(event) => {
            openTriggerGraph(selectedComponent.name, event);
            onOpenTriggers();
          }}
        />
      ) : structuralInspector ?? <Inspector state="empty" />}
    </div>
  );
}
