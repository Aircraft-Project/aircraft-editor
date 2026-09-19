"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import {
  Box,
  Image as ImageIcon,
  List,
  MousePointerClick,
  Network,
  Plus,
  Puzzle,
  Star,
  TextCursorInput,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ComponentSchema } from "@/modules/aircraft-schema";
import {
  createDefaultValues,
  isPropertyApplicable,
} from "../../application";
import { getComponentPresentation } from "../../presentation";
import type { DroppedPaletteItem } from "@/modules/screens/layoutTree";
import styles from "./ComponentsWorkspace.module.css";

const componentIcons: Readonly<Record<string, LucideIcon>> = {
  Button: MousePointerClick,
  TextField: TextCursorInput,
  TextLabel: Type,
  IMAGE: ImageIcon,
  ICON: Star,
  Catalog: List,
  Fractal: Network,
};

interface ComponentsCatalogProps {
  readonly schemas: readonly ComponentSchema[];
  readonly onAdd: (item: DroppedPaletteItem) => void;
}

export function ComponentsCatalog({
  schemas,
  onAdd,
}: ComponentsCatalogProps) {
  const [query, setQuery] = useState("");
  const [selectedSubtypes, setSelectedSubtypes] = useState<
    Readonly<Record<string, string>>
  >({});

  const filteredSchemas = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return schemas;
    }
    return schemas.filter((schema) => {
      const presentation = getComponentPresentation(schema.type);
      return (
        schema.type.toLocaleLowerCase().includes(normalized) ||
        presentation.label.toLocaleLowerCase().includes(normalized) ||
        presentation.description.toLocaleLowerCase().includes(normalized)
      );
    });
  }, [query, schemas]);

  const toPaletteItem = (schema: ComponentSchema): DroppedPaletteItem => {
    const subtype =
      selectedSubtypes[schema.type] ??
      schema.subtypes[0]?.type ??
      "Default";
    const applicableProperties = schema.properties.filter((property) =>
      isPropertyApplicable(property, subtype),
    );
    return {
      type: schema.type,
      subtype,
      initialProperties: createDefaultValues(applicableProperties),
    };
  };

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    schema: ComponentSchema,
  ) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify(toPaletteItem(schema)),
    );
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className={styles.catalog}>
      <div className={styles.moduleHeading}>
        <span className={styles.headingIcon}><Box size={21} /></span>
        <div>
          <h2>Módulo Componentes</h2>
          <p>Arrastra, suelta y personaliza la interfaz.</p>
        </div>
      </div>

      <label className={styles.searchField}>
        <span className="sr-only">Buscar componentes</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar componentes..."
        />
      </label>

      <div className={styles.componentList}>
        {filteredSchemas.map((schema) => {
          const presentation = getComponentPresentation(schema.type);
          const Icon = componentIcons[schema.type] ?? Puzzle;
          const subtype =
            selectedSubtypes[schema.type] ??
            schema.subtypes[0]?.type ??
            "Default";
          return (
            <article
              key={schema.type}
              className={styles.componentCard}
              draggable
              onDragStart={(event) => handleDragStart(event, schema)}
              data-component-type={schema.type}
            >
              <span className={styles.cardIcon}><Icon size={20} /></span>
              <div className={styles.cardCopy}>
                <strong>{presentation.label}</strong>
                <span>{presentation.label === schema.type
                  ? schema.description ?? presentation.description
                  : presentation.description}</span>
                {schema.subtypes.length > 1 ? (
                  <label>
                    <span className="sr-only">
                      Variante de {presentation.label}
                    </span>
                    <select
                      value={subtype}
                      onChange={(event) =>
                        setSelectedSubtypes((current) => ({
                          ...current,
                          [schema.type]: event.target.value,
                        }))
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {schema.subtypes.map((item) => (
                        <option key={item.type} value={item.type}>
                          {item.type}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <small>{subtype}</small>
                )}
              </div>
              <button
                type="button"
                className={styles.addComponent}
                aria-label={`Agregar ${presentation.label} al lienzo`}
                onClick={() => onAdd(toPaletteItem(schema))}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </article>
          );
        })}
        {!filteredSchemas.length ? (
          <p className={styles.emptyCatalog}>
            No encontramos componentes para esa búsqueda.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
