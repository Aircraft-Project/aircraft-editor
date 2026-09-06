import { Plus } from "lucide-react";

import styles from "./NewProjectCard.module.css";

export interface NewProjectCardProps {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <button
      className={styles.card}
      type="button"
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        <Plus size={37} strokeWidth={1.8} />
      </span>
      <strong>Nuevo proyecto</strong>
      <span>
        Crea una nueva app desde cero
        <br />
        o usando una plantilla
      </span>
    </button>
  );
}
