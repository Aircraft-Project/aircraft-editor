import type { SchemaValue } from "@/modules/aircraft-schema";
import { parseTriggerBindingKey } from "@/modules/editor/application/useTriggerGraphStore";
import type {
  BodyNode,
  ColumnNode,
  ComponentNode,
  RowNode,
} from "@/modules/screens/layoutTree";
import {
  AircraftProjectSemanticError,
  type AircraftProject,
  type AircraftSemanticIssue,
  type CatalogItemDocument,
  type LayoutDocument,
  type ScreenDocument,
  type TriggerGraphBindingDocument,
  type TriggerGraphDocument,
} from "../domain";

export type SemanticProjectDocuments = Pick<
  AircraftProject,
  "screens" | "layouts" | "triggerGraphs" | "catalogItems"
>;

type ValidationContext = {
  readonly issues: AircraftSemanticIssue[];
  readonly identifiersByDocument: Map<string, Set<string>>;
  readonly screenIds: Set<string>;
  readonly catalogItemIds: Set<string>;
  readonly componentsByScreen: Map<string, Set<string>>;
};

function takeUnique<T>(values: Set<T>, value: T): boolean {
  if (values.has(value)) return false;
  values.add(value);
  return true;
}

export class AircraftProjectSemanticValidator {
  validate(project: SemanticProjectDocuments): readonly AircraftSemanticIssue[] {
    return this.validateDocuments(project, true);
  }

  validatePartial(
    project: SemanticProjectDocuments,
  ): readonly AircraftSemanticIssue[] {
    return this.validateDocuments(project, false);
  }

  private validateDocuments(
    project: SemanticProjectDocuments,
    requireInterfaces: boolean,
  ): readonly AircraftSemanticIssue[] {
    const issues: AircraftSemanticIssue[] = [];
    const screenIds = new Set(project.screens.map((screen) => screen.screenId));
    const catalogItemIds = new Set(
      project.catalogItems.map((item) => item.catalogItemId),
    );
    const context: ValidationContext = {
      issues,
      identifiersByDocument: new Map(),
      screenIds,
      catalogItemIds,
      componentsByScreen: new Map(),
    };

    this.validateScreens(
      project.screens,
      project.catalogItems,
      context,
      requireInterfaces,
    );
    this.validateLayouts(project.layouts, context);
    project.catalogItems.forEach((item) =>
      this.validateBody(
        item.layout,
        `catalogItems.${item.catalogItemId}.layout`,
        `catalog-item:${item.catalogItemId}`,
        context,
      ),
    );
    this.validateGraphs(project.triggerGraphs, context);
    return issues;
  }

  assertValid(project: SemanticProjectDocuments): void {
    this.assertIssues(this.validate(project));
  }

  assertValidPartial(project: SemanticProjectDocuments): void {
    this.assertIssues(this.validatePartial(project));
  }

  private assertIssues(issues: readonly AircraftSemanticIssue[]): void {
    if (issues.length) throw new AircraftProjectSemanticError(issues);
  }

  private validateScreens(
    screens: readonly ScreenDocument[],
    catalogItems: readonly CatalogItemDocument[],
    context: ValidationContext,
    requireInterfaces: boolean,
  ): void {
    if (!screens.length) {
      if (requireInterfaces) {
        this.issue(context, "M-1", "Project has no interfaces.", "screens");
      }
    } else {
      const initialScreens = screens.filter((screen) => screen.isInitial);
      if (initialScreens.length !== 1) {
        this.issue(
          context,
          "M-2",
          "Project must have exactly one initial interface.",
          "screens",
        );
      }
    }

    const names = new Set<string>();
    const interfaceDestinations = new Set<string>();
    const screenIds = new Set<string>();
    for (const screen of screens) {
      if (!takeUnique(screenIds, screen.screenId)) {
        this.issue(
          context,
          "M-4",
          `Duplicate interface identifier '${screen.screenId}'.`,
          `screens.${screen.screenId}`,
        );
      }
      if (!takeUnique(names, screen.name)) {
        this.issue(
          context,
          "M-3",
          `Duplicate interface name '${screen.name}'.`,
          `screens.${screen.screenId}.name`,
        );
      }
      if (screen.context !== "interface") {
        this.issue(
          context,
          "SCREEN_CONTEXT",
          `Screen '${screen.screenId}' must use context 'interface'.`,
          `screens.${screen.screenId}.context`,
        );
      }
      this.validateDestination(
        screen.destination,
        `screens.${screen.screenId}.destination`,
        interfaceDestinations,
        context,
      );
    }

    const catalogIds = new Set<string>();
    for (const item of catalogItems) {
      if (!takeUnique(catalogIds, item.catalogItemId)) {
        this.issue(
          context,
          "M-8",
          `Duplicate catalog item identifier '${item.catalogItemId}'.`,
          `catalogItems.${item.catalogItemId}`,
        );
      }
      if (item.catalogItemId !== item.name) {
        this.issue(
          context,
          "CATALOG_ITEM_IDENTITY_MISMATCH",
          `Catalog item identifier '${item.catalogItemId}' must equal its name '${item.name}'.`,
          `catalogItems.${item.catalogItemId}.name`,
        );
      }
      if (item.context !== "catalog-item") {
        this.issue(
          context,
          "CATALOG_ITEM_CONTEXT",
          `Catalog item '${item.catalogItemId}' must use context 'catalog-item'.`,
          `catalogItems.${item.catalogItemId}.context`,
        );
      }
    }
  }

  private validateDestination(
    destination: string,
    path: string,
    destinations: Set<string>,
    context: ValidationContext,
  ): void {
    if (
      !destination ||
      destination.trim() !== destination ||
      destination.includes("/") ||
      destination.includes("\\")
    ) {
      this.issue(
        context,
        "M-5",
        `Destination '${destination}' must be a non-empty single segment.`,
        path,
      );
      return;
    }
    if (!takeUnique(destinations, destination)) {
      this.issue(
        context,
        "M-5",
        `Duplicate destination '${destination}'.`,
        path,
      );
    }
  }

  private validateLayouts(
    layouts: Readonly<Record<string, LayoutDocument>>,
    context: ValidationContext,
  ): void {
    for (const screenId of context.screenIds) {
      const layout = layouts[screenId];
      if (!layout) {
        this.issue(
          context,
          "M-2",
          `Interface '${screenId}' has no layout document.`,
          `layouts.${screenId}`,
        );
        continue;
      }
      this.validateBody(
        layout.tree,
        `layouts.${screenId}.tree`,
        `interface:${screenId}`,
        context,
        screenId,
      );
    }
  }

  private validateBody(
    body: BodyNode,
    path: string,
    identifierScope: string,
    context: ValidationContext,
    componentScreenId?: string,
  ): void {
    const components = new Set<string>();
    if (componentScreenId) {
      context.componentsByScreen.set(componentScreenId, components);
    }
    this.addIdentifier(body.id, path, identifierScope, context);

    const visitComponent = (
      component: ComponentNode,
      componentPath: string,
      insideScrollableColumn: boolean,
      row: RowNode,
    ) => {
      this.addIdentifier(
        component.id,
        componentPath,
        identifierScope,
        context,
      );
      components.add(component.id);
      const verticalCatalog =
        component.type === "Catalog" &&
        String(component.properties.orientation ?? "").toLowerCase() ===
          "vertical";
      if (verticalCatalog && insideScrollableColumn) {
        this.issue(
          context,
          "H-9",
          `Scrollable column contains vertical Catalog '${component.id}'.`,
          componentPath,
        );
      }
      if (verticalCatalog) {
        if (row.weight === undefined || row.height !== undefined) {
          this.issue(
            context,
            "H-10",
            `Row '${row.id}' containing a vertical Catalog must use weight and no height.`,
            componentPath,
          );
        }
      }
      if (component.type === "Catalog") {
        const itemView = component.properties.itemView;
        if (
          itemView !== undefined &&
          (typeof itemView !== "string" ||
            !context.catalogItemIds.has(itemView))
        ) {
          this.issue(
            context,
            "M-7",
            `Catalog '${component.id}' references unknown itemView '${itemView}'.`,
            componentPath + ".properties.itemView",
          );
        }
      }
    };

    const visitColumn = (
      column: ColumnNode,
      columnPath: string,
      scrollableAncestor: boolean,
    ) => {
      this.addIdentifier(column.id, columnPath, identifierScope, context);
      const scrollable =
        scrollableAncestor || column.properties.scrollable === true;
      column.rows.forEach((row, index) => {
        const rowPath = `${columnPath}.rows[${index}]`;
        this.addIdentifier(row.id, rowPath, identifierScope, context);
        if (row.height !== undefined && row.weight !== undefined) {
          this.issue(
            context,
            "H-11",
            `Row '${row.id}' cannot define both height and weight.`,
            rowPath,
          );
        }

        const raw = row as RowNode & {
          readonly component?: ComponentNode;
          readonly columns?: readonly ColumnNode[];
          readonly children?: readonly unknown[];
        };
        const hasComponent = raw.component !== undefined;
        const hasColumns = (raw.columns?.length ?? 0) > 0;
        if (
          (hasComponent && hasColumns) ||
          (raw.content === "component" && !hasComponent) ||
          (raw.content === "columns" && !hasColumns) ||
          raw.children !== undefined
        ) {
          this.issue(
            context,
            "H-3",
            `Row '${row.id}' must contain exactly one component or one-or-more columns, never both.`,
            rowPath,
          );
        }

        if (row.content === "component") {
          visitComponent(
            row.component,
            rowPath + ".component",
            scrollable,
            row,
          );
        } else if (row.content === "columns") {
          row.columns.forEach((child, childIndex) =>
            visitColumn(
              child,
              `${rowPath}.columns[${childIndex}]`,
              scrollable,
            ),
          );
        }
      });
    };

    body.columns.forEach((column, index) =>
      visitColumn(column, `${path}.columns[${index}]`, false),
    );
  }

  private validateGraphs(
    documents: Readonly<Record<string, TriggerGraphDocument>>,
    context: ValidationContext,
  ): void {
    for (const [screenId, document] of Object.entries(documents)) {
      if (!context.screenIds.has(screenId)) {
        this.issue(
          context,
          "D-2",
          `Trigger document references unknown screen '${screenId}'.`,
          `triggerGraphs.${screenId}`,
        );
      }
      for (const [bindingKey, graph] of Object.entries(document.graphs)) {
        this.validateGraph(screenId, bindingKey, graph, context);
      }
    }
  }

  private validateGraph(
    screenId: string,
    bindingKey: string,
    graph: TriggerGraphBindingDocument,
    context: ValidationContext,
  ): void {
    const path = `triggerGraphs.${screenId}.graphs.${bindingKey}`;
    const binding = parseTriggerBindingKey(bindingKey);
    if (!binding || binding.screenId !== screenId) {
      this.issue(context, "D-2", "Invalid trigger binding key.", path);
      return;
    }
    if (
      !context.componentsByScreen.get(screenId)?.has(binding.componentId)
    ) {
      this.issue(
        context,
        "D-2",
        `Trigger binding references unknown component '${binding.componentId}'.`,
        path,
      );
    }

    const legacy = graph as unknown as Omit<TriggerGraphBindingDocument, "nodes"> & {
      readonly nodes: readonly (
        | TriggerGraphBindingDocument["nodes"][number]
        | {
            readonly id: string;
            readonly kind: "event";
            readonly type: string;
            readonly label: string;
            readonly properties: Readonly<Record<string, SchemaValue>>;
          }
      )[];
    };
    const eventNodes = legacy.nodes.filter((node) => node.kind === "event");
    const triggerNodes = legacy.nodes.filter(
      (node): node is TriggerGraphBindingDocument["nodes"][number] =>
        node.kind === "trigger",
    );
    const triggerIds = new Set<string>();
    for (const node of triggerNodes) {
      if (!takeUnique(triggerIds, node.id)) {
        this.issue(
          context,
          "D-3",
          `Duplicate trigger vertex '${node.id}'.`,
          path + ".nodes",
        );
      }
      this.addIdentifier(
        node.id,
        path + ".nodes." + node.id,
        `interface:${screenId}`,
        context,
      );
    }

    const eventIds = new Set(eventNodes.map((node) => node.id));
    const eventOutgoing = legacy.edges.filter((edge) =>
      eventIds.has(edge.source),
    );
    if (eventOutgoing.length > 1) {
      this.issue(
        context,
        "D-2",
        "Event UI node must have at most one outgoing edge.",
        path + ".edges",
      );
    }
    if (legacy.edges.some((edge) => eventIds.has(edge.target))) {
      this.issue(
        context,
        "D-4",
        "Edges cannot target the Event UI node.",
        path + ".edges",
      );
    }

    const root =
      graph.rootVertexId ??
      (eventOutgoing.length === 1 ? eventOutgoing[0].target : null);
    if (!triggerNodes.length) {
      if (root !== null) {
        this.issue(
          context,
          "D-2",
          "Empty trigger graph cannot declare a root vertex.",
          path + ".rootVertexId",
        );
      }
      return;
    }
    if (!root || !triggerIds.has(root)) {
      this.issue(
        context,
        "D-2",
        "Non-empty trigger graph must reference an existing root vertex.",
        path + ".rootVertexId",
      );
      return;
    }

    const adjacency = new Map<string, string[]>();
    triggerIds.forEach((id) => adjacency.set(id, []));
    for (const edge of legacy.edges) {
      if (eventIds.has(edge.source)) continue;
      if (!triggerIds.has(edge.source) || !triggerIds.has(edge.target)) {
        this.issue(
          context,
          "D-4",
          `Trigger edge '${edge.id}' references an unknown vertex.`,
          path + ".edges",
        );
        continue;
      }
      adjacency.get(edge.source)?.push(edge.target);
    }

    const reachable = new Set<string>([root]);
    const queue = [root];
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      for (const successor of adjacency.get(current) ?? []) {
        if (!reachable.has(successor)) {
          reachable.add(successor);
          queue.push(successor);
        }
      }
    }
    for (const id of triggerIds) {
      if (!reachable.has(id)) {
        this.issue(
          context,
          "D-5",
          `Trigger vertex '${id}' is unreachable from root '${root}'.`,
          path + ".nodes." + id,
        );
      }
    }

    for (const node of triggerNodes) {
      if (node.type !== "Navigation") continue;
      const navigationType = node.properties.type;
      const target = node.properties.target;
      if (
        (navigationType === "Navigate" || navigationType === "PopTo") &&
        target !== undefined &&
        (typeof target !== "string" || !context.screenIds.has(target))
      ) {
        this.issue(
          context,
          "M-6",
          `Navigation target '${target}' does not reference an interface.`,
          path + ".nodes." + node.id + ".properties.target",
        );
      }
    }
  }

  private addIdentifier(
    identifier: string,
    path: string,
    documentId: string,
    context: ValidationContext,
  ): void {
    const identifiers =
      context.identifiersByDocument.get(documentId) ?? new Set<string>();
    context.identifiersByDocument.set(documentId, identifiers);
    if (!takeUnique(identifiers, identifier)) {
      this.issue(
        context,
        "T-4",
        `Duplicate semantic identifier '${identifier}' within '${documentId}'.`,
        path,
      );
    }
  }

  private issue(
    context: ValidationContext,
    code: string,
    message: string,
    path?: string,
  ): void {
    context.issues.push({ code, message, path });
  }
}
