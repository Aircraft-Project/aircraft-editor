import type { Project } from "@/modules/projects";
import type {
  EditorTriggerGraph,
} from "@/modules/editor/application/useTriggerGraphStore";
import type { EditorScreen } from "@/store/useEditorStore";
import {
  DOCUMENT_VERSION,
  type AircraftProject,
  type LayoutDocument,
  type LocalProjectSummary,
  type ScreenDocument,
  type TriggerGraphDocument,
} from "../domain";

export function localSummaryToProject(
  summary: LocalProjectSummary,
): Project {
  return { ...summary };
}

export function projectToEditorState(project: AircraftProject) {
  const screens: EditorScreen[] = [...project.screens]
    .sort((left, right) => left.order - right.order)
    .map(({ screenId, name, description, context }) => ({
      id: screenId,
      name,
      description,
      context,
    }));
  const screenTrees = Object.fromEntries(
    Object.values(project.layouts).map((document) => [
      document.screenId,
      document.tree,
    ]),
  );
  const graphs = Object.assign(
    {},
    ...Object.values(project.triggerGraphs).map(
      (document) => document.graphs,
    ),
  ) as Record<string, EditorTriggerGraph>;

  return {
    screens,
    screenTrees,
    graphs,
    initialScreenId:
      project.screens.find((screen) => screen.isInitial)?.screenId ??
      screens[0]?.id ??
      "",
    activeScreenId: project.settings.activeScreenId,
  };
}

export function createScreenDocuments(
  screens: readonly EditorScreen[],
  initialScreenId: string,
): readonly ScreenDocument[] {
  return screens.map((screen, order) => ({
    documentVersion: DOCUMENT_VERSION,
    screenId: screen.id,
    name: screen.name,
    description: screen.description,
    context: screen.context,
    isInitial: screen.id === initialScreenId,
    order,
  }));
}

export function createLayoutDocument(
  screenId: string,
  tree: LayoutDocument["tree"],
): LayoutDocument {
  return { documentVersion: DOCUMENT_VERSION, screenId, tree };
}

export function createTriggerGraphDocument(
  screenId: string,
  graphs: Readonly<Record<string, EditorTriggerGraph>>,
): TriggerGraphDocument {
  const prefix = encodeURIComponent(screenId) + ":";
  return {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    graphs: Object.fromEntries(
      Object.entries(graphs).filter(([bindingKey]) =>
        bindingKey.startsWith(prefix),
      ),
    ),
  };
}
