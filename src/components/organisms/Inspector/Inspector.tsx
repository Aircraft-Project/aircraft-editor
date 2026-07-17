import { Button } from "@/components/atoms";
import { EventRow, InspectorPropertyRow } from "@/components/molecules";
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

type InspectorProps =
  | { state: "empty" }
  | { state: "component"; data: ComponentInspectorData; onSelectEvent?: (eventName: string) => void }
  | { state: "vertex"; data: VertexInspectorData };

export function Inspector(props: InspectorProps) {
  if (props.state === "empty") {
    return (
      <aside className={styles.inspector}>
        <div className={styles.empty}>Seleccioná un elemento para ver sus propiedades</div>
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
            <InspectorPropertyRow key={property.label} label={property.label} value={property.value} required={property.required} />
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
