import { Button, Select } from "@/components/atoms";
import { EventRow, InspectorPropertyRow } from "@/components/molecules";
import type { RowHeight } from "@/modules/screens/layoutTree";
import styles from "./Inspector.module.css";

type ComponentInspectorData = {
  name: string;
  type: string;
  subtype: string;
  id: string;
  properties: Array<{ label: string; value: string; required?: boolean }>;
  observers: string[];
  events: Array<{ name: string; configured: boolean }>;
};

type VertexInspectorData = {
  type: string;
  name: string;
  id: string;
  properties: Array<{ label: string; value: string; required?: boolean; error?: string }>;
};

type RowInspectorData = {
  id: string;
  height: RowHeight;
  /** Si está definido, height se ignora por completo (Casuística 2). */
  weight: number | undefined;
};

type ColumnInspectorData = {
  id: string;
  weight: number;
};

type InspectorProps =
  | { state: "empty" }
  | {
      state: "component";
      data: ComponentInspectorData;
      onSelectEvent?: (eventName: string) => void;
      onPropertyChange?: (label: string, value: string) => void;
    }
  | { state: "vertex"; data: VertexInspectorData }
  | {
      state: "row";
      data: RowInspectorData;
      onWeightChange?: (weight: number | undefined) => void;
      onHeightChange?: (height: RowHeight) => void;
    }
  | { state: "column"; data: ColumnInspectorData; onWeightChange?: (weight: number) => void };

export function Inspector(props: InspectorProps) {
  if (props.state === "empty") {
    return (
      <aside className={styles.inspector}>
        <div className={styles.empty}>Seleccioná un elemento para ver sus propiedades</div>
      </aside>
    );
  }

  if (props.state === "row") {
    const { id, weight, height } = props.data;
    const weightDefined = weight !== undefined;
    return (
      <aside className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>Type:</span>
            <span className={styles.headerValue}>Row</span>
          </div>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>ID:</span>
            <span className={styles.headerValue}>{id}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>PROPIEDADES</div>

          <Select
            label="height"
            value={height}
            onChange={(event) => props.onHeightChange?.(event.target.value as RowHeight)}
          >
            <option value="wrap_content">wrap_content</option>
            <option value="match_parent">match_parent</option>
          </Select>
          {weightDefined ? (
            <p className={styles.hint}>height se ignora: weight está definido y siempre gana.</p>
          ) : null}

          <InspectorPropertyRow
            label="weight"
            value={weight === undefined ? "" : String(weight)}
            onChange={(value) => {
              if (value.trim() === "") {
                props.onWeightChange?.(undefined);
                return;
              }
              const parsed = Number(value);
              props.onWeightChange?.(Number.isNaN(parsed) ? 0 : parsed);
            }}
          />
          <p className={styles.hint}>
            Vacío = se respeta height. Con un número, height se ignora y la row compite por el
            espacio vertical sobrante de la column de forma ponderada frente a sus rows hermanas con
            weight: Altura% = (weight × 100) / suma(weights de las rows con weight).
          </p>
        </div>
      </aside>
    );
  }

  if (props.state === "column") {
    const { id, weight } = props.data;
    return (
      <aside className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>Type:</span>
            <span className={styles.headerValue}>Column</span>
          </div>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>ID:</span>
            <span className={styles.headerValue}>{id}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>PROPIEDADES</div>
          <InspectorPropertyRow
            label="weight"
            value={String(weight)}
            onChange={(value) => {
              const parsed = Number(value);
              props.onWeightChange?.(Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed);
            }}
          />
          <p className={styles.hint}>
            Anchura% = (weight × 100) / suma(weights de todas las columns del Body). Default: 1 (todas
            las columns iguales).
          </p>
        </div>
      </aside>
    );
  }

  if (props.state === "component") {
    const { name, type, subtype, id, properties, observers, events } = props.data;
    return (
      <aside className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>Nombre:</span>
            <span className={styles.headerValue}>{name}</span>
          </div>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>Type:</span>
            <span className={styles.headerValue}>{type} / {subtype}</span>
          </div>
          <div className={styles.headerRow}>
            <span className={styles.headerLabel}>ID:</span>
            <span className={styles.headerValue}>{id}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>PROPIEDADES</div>
          {properties.map((property) => (
            <InspectorPropertyRow
              key={property.label}
              label={property.label}
              value={property.value}
              required={property.required}
              onChange={(value) => props.onPropertyChange?.(property.label, value)}
            />
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>OBSERVERS</div>
          <div className={styles.observerList}>
            {observers.map((observer) => (
              <div key={observer} className={styles.observerItem}>
                <span>• {observer}</span>
                <button type="button" className={styles.removeObserver}>×</button>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm">+ Agregar observer</Button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>EVENTOS (→ Trigger Graph)</div>
          {events.map((event) => (
            <EventRow
              key={event.name}
              eventName={event.name}
              configured={event.configured}
              onClick={() => props.onSelectEvent?.(event.name)}
            />
          ))}
        </div>
      </aside>
    );
  }

  const { type, name, id, properties } = props.data;
  return (
    <aside className={styles.inspector}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.headerLabel}>Type:</span>
          <span className={styles.headerValue}>{type}</span>
        </div>
        <div className={styles.headerRow}>
          <span className={styles.headerLabel}>Name:</span>
          <span className={styles.headerValue}>{name}</span>
        </div>
        <div className={styles.headerRow}>
          <span className={styles.headerLabel}>ID:</span>
          <span className={styles.headerValue}>{id}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>PROPIEDADES DEL TRIGGER</div>
        {properties.map((property) => (
          <InspectorPropertyRow
            key={property.label}
            label={property.label}
            value={property.value}
            required={property.required}
            error={property.error}
          />
        ))}
      </div>
    </aside>
  );
}
