"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Puzzle, RefreshCw, Workflow } from "lucide-react";
import type {
  ComponentSchema,
  ContextRules,
  SchemaProvider,
  SchemaValue,
} from "@/modules/aircraft-schema";
import { isPropertyApplicable } from "../../application";
import {
  getComponentPresentation,
  getEventLabel,
} from "../../presentation";
import { SchemaPropertyForm } from "../SchemaPropertyForm";
import type { ComponentNode } from "@/modules/screens/layoutTree";
import styles from "./ComponentsWorkspace.module.css";

interface DynamicComponentInspectorProps {
  readonly component: ComponentNode;
  readonly contextRules: ContextRules;
  readonly provider: SchemaProvider;
  readonly onRename: (name: string) => void;
  readonly onPropertyChange: (name: string, value: SchemaValue) => void;
  readonly onSelectEvent: (event: string) => void;
}

export function DynamicComponentInspector({
  component,
  contextRules,
  provider,
  onRename,
  onPropertyChange,
  onSelectEvent,
}: DynamicComponentInspectorProps) {
  const [schema, setSchema] = useState<ComponentSchema | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);

  const load = useCallback(() => {
    setStatus("loading");
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let current = true;
    provider
      .getComponent(component.type)
      .then((definition) => {
        if (!current) return;
        setSchema(definition);
        setStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setStatus("error");
      });
    return () => {
      current = false;
    };
  }, [component.type, provider, revision]);

  const properties = useMemo(
    () =>
      schema?.properties.filter((property) =>
        isPropertyApplicable(property, component.subtype),
      ) ?? [],
    [component.subtype, schema],
  );
  const presentation = getComponentPresentation(component.type);

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorTabs} role="tablist">
        <button type="button" role="tab" aria-selected="true">
          Propiedades
        </button>
        <button type="button" role="tab" aria-selected="false" disabled>
          Guía
        </button>
      </div>

      <div className={styles.inspectorHeader}>
        <span className={styles.inspectorIcon}><Puzzle size={22} /></span>
        <div>
          <strong>{presentation.label}</strong>
          <span>{presentation.label === component.type
            ? schema?.description ?? presentation.description
            : presentation.description}</span>
          <small>{component.type} / {component.subtype}</small>
        </div>
      </div>

      <section className={styles.inspectorSection}>
        <h3>Identidad</h3>
        <label className={styles.textField}>
          <span>Nombre del componente</span>
          <input
            value={component.name}
            onChange={(event) => onRename(event.target.value)}
          />
        </label>
      </section>

      <section className={styles.inspectorSection}>
        <h3>Propiedades</h3>
        {status === "loading" ? (
          <p role="status" className={styles.localStatus}>
            Cargando definición...
          </p>
        ) : null}
        {status === "error" ? (
          <div role="alert" className={styles.schemaError}>
            <AlertCircle size={18} />
            <span>No fue posible cargar esta definición.</span>
            <button type="button" onClick={load}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        ) : null}
        {status === "ready" ? (
          <SchemaPropertyForm
            properties={properties}
            values={component.properties}
            onChange={onPropertyChange}
          />
        ) : null}
      </section>

      <section className={styles.inspectorSection}>
        <h3>Comportamiento</h3>
        {contextRules.supportsTriggers ? (
          schema?.effectiveEvents.map((event) => (
            <button
              key={event.type}
              type="button"
              className={styles.eventButton}
              onClick={() => onSelectEvent(event.type)}
            >
              <Workflow size={15} />
              {getEventLabel(event.type)}
            </button>
          ))
        ) : (
          <p className={styles.contextNotice}>
            Este contexto no admite triggers ni observers.
          </p>
        )}
      </section>
    </aside>
  );
}
