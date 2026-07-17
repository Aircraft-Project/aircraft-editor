"use client";

import { useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ASTNodeIndicator } from "@/components/atoms";
import { ASTNodeCard } from "@/components/molecules";
import { Inspector, LeftPanel, ScreensCarousel, Topbar, type Screen } from "@/components/organisms";
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
  const { mode, activeScreenId, activeEvent, setActiveScreen, openTriggerGraph, backToLayout } = useEditorStore();
  const [componentSelected, setComponentSelected] = useState(true);

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

    if (componentSelected) {
      return {
        state: "component" as const,
        data: {
          name: "btnRegister",
          type: "Button",
          subtype: "Simple",
          id: "btn_register",
          properties: [{ label: "label", value: "Registrarme", required: true }],
          observers: ["txt_status_label", "img_loading_spinner"],
          events: [
            { name: "ON_CLICK", configured: true },
            { name: "ON_OBSERVE", configured: false },
            { name: "ON_TRIGGERING", configured: false },
            { name: "ON_CREATE", configured: false },
          ],
        },
        onSelectEvent: (eventName: string) => openTriggerGraph("btnRegister", eventName),
      };
    }

    return { state: "empty" as const };
  }, [mode, activeEvent, componentSelected, openTriggerGraph]);

  return (
    <div className={styles.view}>
      <Topbar projectName={projectName} onBack={onBackToProjects} />

      <div className={styles.body}>
        <LeftPanel disabled={mode === "trigger-graph"} />

        <div className={styles.canvas}>
          {mode === "layout" ? (
            <div className={styles.layoutCanvas}>
              <div className={styles.astBody}>
                <ASTNodeIndicator label="Body" color="var(--node-body)" />
                <div className={styles.astColumn}>
                  <ASTNodeIndicator label="Column" color="var(--node-column)" />
                  <div className={styles.astRow}>
                    <ASTNodeIndicator label="Row" color="var(--node-row)" />
                    <div style={{ marginTop: 8 }}>
                      <ASTNodeCard
                        type="Button"
                        name="Submit Button"
                        selected={componentSelected}
                        hasTriggers
                        onClick={() => setComponentSelected(true)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
