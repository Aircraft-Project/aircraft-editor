import { StatusBadge } from "@/components/atoms";
import styles from "./EventRow.module.css";

type EventRowProps = {
  eventName: string;
  configured: boolean;
  onClick?: () => void;
};

export function EventRow({ eventName, configured, onClick }: EventRowProps) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <span className={styles.name}>{eventName}</span>
      <span className={styles.right}>
        <StatusBadge label={configured ? "Configurado" : "Vacío"} configured={configured} />
        <span className={styles.arrow}>→</span>
      </span>
    </button>
  );
}
