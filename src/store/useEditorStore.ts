import { create } from "zustand";

export type CanvasMode = "layout" | "trigger-graph";

type EditorState = {
  mode: CanvasMode;
  activeScreenId: string;
  /** Evento activo cuando mode === "trigger-graph" (PRD §6.2). */
  activeEvent: { componentName: string; eventName: string } | null;
  setActiveScreen: (screenId: string) => void;
  openTriggerGraph: (componentName: string, eventName: string) => void;
  backToLayout: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  mode: "layout",
  activeScreenId: "home",
  activeEvent: null,
  setActiveScreen: (screenId) => set({ activeScreenId: screenId }),
  openTriggerGraph: (componentName, eventName) =>
    set({ mode: "trigger-graph", activeEvent: { componentName, eventName } }),
  backToLayout: () => set({ mode: "layout", activeEvent: null }),
}));
