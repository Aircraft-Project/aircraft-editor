import { designTokens } from "@/design/tokens";
import styles from "./ASTNodeIndicator.module.css";

type ASTNodeIndicatorProps = {
  label: string;
  /** Color del borde/label cuando no está seleccionado (ej. designTokens.nodeColumn). */
  color: string;
  selected?: boolean;
};

export function ASTNodeIndicator({ label, color, selected }: ASTNodeIndicatorProps) {
  const labelColor = selected ? designTokens.stateSelected : color;

  return (
    <div
      className={[styles.indicator, selected ? styles.selected : ""].filter(Boolean).join(" ")}
      style={selected ? undefined : { border: `1px solid ${color}` }}
    >
      <span className={styles.label} style={{ color: labelColor }}>
        {label}
      </span>
    </div>
  );
}
