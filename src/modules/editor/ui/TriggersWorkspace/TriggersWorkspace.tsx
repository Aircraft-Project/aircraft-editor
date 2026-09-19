"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  GitBranch,
  Plus,
  Puzzle,
  RefreshCw,
  Workflow,
} from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  ContextRules,
  EventDefinition,
  SchemaProvider,
  TriggerDefinition,
  TriggerSchema,
} from "@/modules/aircraft-schema";
import {
  createDefaultValues,
  type EditorGraphNode,
  useTriggerGraphStore,
} from "../../application";
import {
  getEventLabel,
  getTriggerPresentation,
} from "../../presentation";
import { SchemaPropertyForm } from "../SchemaPropertyForm";
import { listComponents } from "@/modules/screens/layoutTree";
import { useEditorStore } from "@/store/useEditorStore";
import styles from "./TriggersWorkspace.module.css";

interface TriggersWorkspaceProps {
  readonly provider: SchemaProvider;
}

export function TriggersWorkspace({
  provider,
}: TriggersWorkspaceProps) {
  const { activeScreenId, screens, screenTrees, selection } =
    useEditorStore();
  const graph = useTriggerGraphStore();
  const activeScreen =
    screens.find((screen) => screen.id === activeScreenId) ?? screens[0];
  const components = useMemo(
    () => listComponents(screenTrees[activeScreenId]),
    [activeScreenId, screenTrees],
  );
  const initiallySelected =
    selection?.kind === "component"
      ? components.find((component) => component.id === selection.id)?.id
      : undefined;
  const [componentId, setComponentId] = useState<string | undefined>(
    initiallySelected,
  );
  const selectedComponent =
    components.find(
      (component) =>
        component.id === (componentId ?? initiallySelected ?? components[0]?.id),
    ) ?? null;
  const [events, setEvents] = useState<readonly EventDefinition[]>([]);
  const [triggers, setTriggers] = useState<readonly TriggerDefinition[]>([]);
  const [rules, setRules] = useState<ContextRules | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([
      provider.listTriggers(),
      provider.getContextRules(activeScreen.context),
    ])
      .then(([definitions, contextRules]) => {
        if (!current) return;
        setTriggers(definitions);
        setRules(contextRules);
        setStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [activeScreen.context, provider, revision]);

  useEffect(() => {
    let current = true;
    if (!selectedComponent) {
      return () => {
        current = false;
      };
    }
    provider
      .getEffectiveEvents(selectedComponent.type)
      .then((definitions) => {
        if (!current) return;
        setEvents(definitions);
      })
      .catch(() => {
        if (!current) return;
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [provider, selectedComponent]);

  const activeGraph = graph.bindingKey
    ? graph.graphs[graph.bindingKey]
    : undefined;
  const graphNodes = activeGraph?.nodes ?? [];
  const graphEdges = activeGraph?.edges ?? [];

  const flowNodes: Node[] = graphNodes.map((node, index) => ({
    id: node.id,
    position: { x: 45 + index * 205, y: 180 },
    data: { label: node.label },
    style: {
      width: 165,
      minHeight: 92,
      display: "grid",
      placeItems: "center",
      textAlign: "center",
      color: "#f4fbff",
      background:
        node.kind === "event"
          ? "linear-gradient(145deg, #075692, #053158)"
          : "linear-gradient(145deg, #162f55, #071d36)",
      border:
        node.id === activeGraph?.selectedNodeId
          ? "2px solid #17d2ff"
          : "1px solid rgba(80, 166, 226, .55)",
      borderRadius: 12,
      boxShadow:
        node.id === activeGraph?.selectedNodeId
          ? "0 0 22px rgba(16, 184, 255, .2)"
          : "none",
    },
  }));
  const flowEdges: Edge[] = graphEdges.map((edge) => ({
    ...edge,
    animated: false,
    style: { stroke: "#20bfff", strokeWidth: 2 },
  }));
  const selectedNode =
    graphNodes.find((node) => node.id === activeGraph?.selectedNodeId) ?? null;

  if (status === "loading") {
    return (
      <div className={styles.workspaceState} role="status">
        Cargando eventos y acciones...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.workspaceState} role="alert">
        <AlertCircle size={24} />
        <strong>No fue posible cargar las definiciones.</strong>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  if (!rules?.supportsTriggers) {
    return (
      <div className={styles.workspaceState}>
        <Workflow size={28} />
        <strong>Triggers no disponibles</strong>
        <p>
          El contexto {activeScreen.context} no admite triggers según el
          SchemaProvider.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.catalog}>
        <div className={styles.heading}>
          <span><Workflow size={22} /></span>
          <div>
            <h2>Módulo Triggers</h2>
            <p>Conecta eventos con acciones.</p>
          </div>
        </div>

        <label className={styles.componentSelect}>
          <span>Componente</span>
          <select
            value={selectedComponent?.id ?? ""}
            onChange={(event) => setComponentId(event.target.value)}
            disabled={!components.length}
          >
            {!components.length ? (
              <option value="">Sin componentes</option>
            ) : null}
            {components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name}
              </option>
            ))}
          </select>
        </label>

        <section className={styles.catalogSection}>
          <h3>Eventos disponibles</h3>
          {selectedComponent ? (
            events.map((event) => (
              <button
                key={event.type}
                type="button"
                className={styles.catalogCard}
                onClick={() =>
                  graph.startEvent(
                    activeScreen.id,
                    selectedComponent.id,
                    event.type,
                    getEventLabel(event.type),
                  )
                }
              >
                <GitBranch size={18} />
                <span>
                  <strong>{getEventLabel(event.type)}</strong>
                  <small>{event.type}</small>
                </span>
              </button>
            ))
          ) : (
            <p>Agrega un componente al lienzo para ver sus eventos.</p>
          )}
        </section>

        <section className={styles.catalogSection}>
          <h3>Acciones disponibles</h3>
          {triggers.map((trigger) => {
            const presentation = getTriggerPresentation(trigger.type);
            return (
              <button
                key={trigger.type}
                type="button"
                className={styles.catalogCard}
                disabled={!graph.bindingKey}
                onClick={async () => {
                  const schema = await provider.getTrigger(trigger.type);
                  graph.addTrigger(
                    schema.type,
                    presentation.label,
                    createDefaultValues([
                      ...schema.requiredProperties,
                      ...schema.optionalProperties,
                    ]),
                  );
                }}
                data-trigger-type={trigger.type}
              >
                <Plus size={18} />
                <span>
                  <strong>{presentation.label}</strong>
                  <small>{presentation.description}</small>
                </span>
              </button>
            );
          })}
        </section>
      </aside>

      <main className={styles.graph}>
        {graphNodes.length ? (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodesDraggable={false}
            nodesConnectable
            onConnect={({ source, target }) => {
              if (source && target) {
                graph.connectNodes(source, target);
              }
            }}
            elementsSelectable
            onNodeClick={(_, node) => graph.selectNode(node.id)}
            fitView
          >
            <Background color="#0d5d93" gap={20} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        ) : (
          <div className={styles.graphEmpty}>
            <Workflow size={34} />
            <strong>Selecciona un evento</strong>
            <span>Después podrás agregar acciones desde el catálogo.</span>
          </div>
        )}
      </main>

      <TriggerInspector
        provider={provider}
        node={selectedNode}
      />
    </div>
  );
}

function TriggerInspector({
  provider,
  node,
}: {
  readonly provider: SchemaProvider;
  readonly node: EditorGraphNode | null;
}) {
  const setNodeProperty = useTriggerGraphStore(
    (state) => state.setNodeProperty,
  );
  const [schema, setSchema] = useState<TriggerSchema | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    if (!node || node.kind !== "trigger") {
      return () => {
        current = false;
      };
    }
    provider
      .getTrigger(node.type)
      .then((definition) => {
        if (!current) return;
        setSchema(definition);
        setFailed(false);
      })
      .catch(() => {
        if (!current) return;
        setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [node, provider]);

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorTabs} role="tablist">
        <button type="button" role="tab" aria-selected="true">Propiedades</button>
        <button type="button" role="tab" aria-selected="false" disabled>Guía</button>
      </div>
      {!node ? (
        <div className={styles.inspectorEmpty}>
          Selecciona un evento o acción para ver sus propiedades.
        </div>
      ) : (
        <>
          <div className={styles.inspectorHeader}>
            <span><Puzzle size={22} /></span>
            <div>
              <strong>{node.label}</strong>
              <small>{node.type}</small>
            </div>
          </div>
          {node.kind === "event" ? (
            <section className={styles.inspectorSection}>
              <h3>Evento</h3>
              <p>
                Este evento inicia el flujo seleccionado. Sus acciones pueden
                conectarse en cualquier orden, incluidos ciclos.
              </p>
            </section>
          ) : null}
          {node.kind === "trigger" && failed ? (
            <p role="alert" className={styles.inspectorSection}>
              No fue posible cargar esta definición.
            </p>
          ) : null}
          {node.kind === "trigger" && schema?.type === node.type ? (
            <section className={styles.inspectorSection}>
              <h3>Configuración</h3>
              <SchemaPropertyForm
                properties={[
                  ...schema.requiredProperties,
                  ...schema.optionalProperties,
                ]}
                values={node.properties}
                onChange={(name, value) =>
                  setNodeProperty(node.id, name, value)
                }
              />
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}
