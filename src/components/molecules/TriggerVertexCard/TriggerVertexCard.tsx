import { designTokens } from "@/design/tokens";
import styles from "./TriggerVertexCard.module.css";

type TriggerVertexCardProps = {
  /** Tipo de trigger publicado por el SchemaProvider (PRD §4.2), ej. "API_CALL", "NAVIGATE". */
  triggerType: string;
  /** Color de header por tipo de trigger. La galería no define una paleta fija para esto: elegir uno consistente por tipo al integrar el SchemaProvider real. */
  color?: string;
  properties: Array<{ key: string; value: string }>;
  selected?: boolean;
};

export function TriggerVertexCard({
  triggerType,
  color = designTokens.accentPrimary,
  properties,
  selected,
}: TriggerVertexCardProps) {
  return (
    <div className={[styles.card, selected ? styles.selected : ""].filter(Boolean).join(" ")}>
      <div className={styles.header} style={{ background: color }}>
        {triggerType}
      </div>
      <div className={styles.body}>
        {properties.map((property) => (
          <div key={property.key} className={styles.property}>
            <span className={styles.propertyKey}>{property.key}:</span>{" "}
            <span className={styles.propertyValue}>{property.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
