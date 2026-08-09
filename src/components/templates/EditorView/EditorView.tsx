"use client";

import { useMemo } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Inspector, LayoutCanvas, LeftPanel, ScreensCarousel, Topbar, type Screen } from "@/components/organisms";
import { findColumn, findComponent, findRow } from "@/modules/screens/layoutTree";
import { useEditorStore } from "@/store/useEditorStore";
import styles from "./EditorView.module.css";

const demoScreens: Screen[] = [
  { id: "home", name: "Home", documentContext: "INTERFACE" },
  { id: "login", name: "Login", documentContext: "INTERFACE" },
];

/**
 * Grafo de demostración basado en el ejemplo del PRD §4.2 (btn_register / ON_CLICK).
 * Placeholder para probar que @xyflow/react está bien integrado — no hay
 * TriggerGraph real todavía (no hay AST ni SchemaProvider conectados).
 */
const demoNodes: Node[] = [
  { id: "switch_valid", position: { x: 0, y: 0 }, data: { label: "ConditionalSwitcher\nswitch_valid" } },
  { id: "api_register", position: { x: -160, y: 120 }, data: { label: "ApiService\napi_register" } },
  { id: "state_show_err", position: { x: 160, y: 120 }, data: { label: "StateComp\nstate_show_err" } },
  { id: "nav_welcome", position: { x: -160, y: 240 }, data: { label: "Navigation\nnav_welcome" } },
];

const demoEdges: Edge[] = [
  { id: "e1", source: "switch_valid", target: "api_register", label: "tests[0]" },
  { id: "e2", source: "switch_valid", target: "state_show_err", label: "default" },
  { id: "e3", source: "api_register", target: "nav_welcome" },
];

type EditorViewProps = {
  projectName: string;
  onBackToProjects?: () => void;
};

export function EditorView({ projectName, onBackToProjects }: EditorViewProps) {
  const {
    mode,
    activeScreenId,
    activeEvent,
    screenTrees,
    selection,
    setActiveScreen,
    openTriggerGraph,
    backToLayout,
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
    dropOnColumn,
    dropOnRow,
  } = useEditorStore();

  const body = screenTrees[activeScreenId];

  const inspectorProps = useMemo(() => {
    if (mode === "trigger-graph" && activeEvent) {
      return {
        state: "vertex" as const,
        data: {
          type: "ConditionalSwitcher",
          name: "switch_valid",
          id: "switch_valid",
          properties: [
            { label: "checkExpression", value: "@email != '' AND @pwd != ''", required: true },
            { label: "jumpStatement", value: "api_register" },
          ],
        },
      };
    }

    if (selection?.kind === "row") {
      const row = findRow(body, selection.id);
      if (row) {
        return {
          state: "row" as const,
          data: { id: row.id, weight: row.weight, height: row.height },
          onWeightChange: (weight: number | undefined) => setRowWeight(row.id, weight),
          onHeightChange: (height: typeof row.height) => setRowHeight(row.id, height),
        };
      }
    }

    if (selection?.kind === "column") {
      const column = findColumn(body, selection.id);
      if (column) {
        return {
          state: "column" as const,
          data: { id: column.id, weight: column.weight },
          onWeightChange: (weight: number) => setColumnWeight(column.id, weight),
        };
      }
    }

    if (selection?.kind === "component") {
      const component = findComponent(body, selection.id);
      if (component) {
        return {
          state: "component" as const,
          data: {
            name: component.name,
            type: component.type,
            subtype: component.subtype,
            id: component.id,
            properties: [{ label: "name", value: component.name, required: true }],
            observers: [],
            events: [
              { name: "ON_CLICK", configured: false },
              { name: "ON_OBSERVE", configured: false },
              { name: "ON_CREATE", configured: false },
            ],
          },
          onSelectEvent: (eventName: string) => openTriggerGraph(component.name, eventName),
          onPropertyChange: (label: string, value: string) => {
            if (label === "name") renameComponent(component.id, value);
          },
        };
      }
    }

    return { state: "empty" as const };
  }, [mode, activeEvent, selection, body, openTriggerGraph, renameComponent, setRowWeight, setRowHeight, setColumnWeight]);

  return (
    <div className={styles.view}>
      <Topbar projectName={projectName} onBack={onBackToProjects} />

      <div className={styles.body}>
        <LeftPanel disabled={mode === "trigger-graph"} />

        <div className={styles.canvas}>
          {mode === "layout" ? (
            <LayoutCanvas
              body={body}
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
          ) : (
            <>
              <div className={styles.triggerGraphHeader}>
                <button type="button" className={styles.triggerGraphBack} onClick={backToLayout}>
                  ← Back
                </button>
                <span>
                  {activeEvent?.componentName} › {activeEvent?.eventName}
                </span>
              </div>
              <div className={styles.triggerGraphFlow}>
                <ReactFlow nodes={demoNodes} edges={demoEdges} fitView>
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>
              </div>
            </>
          )}
        </div>

        <Inspector {...inspectorProps} />
      </div>

      <ScreensCarousel screens={demoScreens} activeScreenId={activeScreenId} onSelectScreen={setActiveScreen} />
    </div>
  );
}
