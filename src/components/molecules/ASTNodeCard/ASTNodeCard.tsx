import { ComponentType, componentTypeColors } from "@/design/tokens";
import styles from "./ASTNodeCard.module.css";

type ASTNodeCardProps = {
  type: ComponentType;
  name: string;
  selected?: boolean;
  hasTriggers?: boolean;
  onClick?: () => void;
};

export function ASTNodeCard({ type, name, selected, hasTriggers, onClick }: ASTNodeCardProps) {
  const color = componentTypeColors[type];

  return (
    <div
      className={[styles.card, selected ? styles.selected : ""].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {hasTriggers ? <span className={styles.triggerDot} /> : null}
      <div className={styles.header}>
        <span className={styles.typeIcon} style={{ color }}>
          {type.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.typeLabel} style={{ color }}>
          {type}
        </span>
      </div>
      <div className={styles.name}>{name}</div>
    </div>
  );
}
