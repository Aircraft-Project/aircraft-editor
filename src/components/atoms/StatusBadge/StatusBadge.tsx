import styles from "./StatusBadge.module.css";

type StatusBadgeProps = {
  label: string;
  configured: boolean;
};

export function StatusBadge({ label, configured }: StatusBadgeProps) {
  const stateClass = configured ? styles.configured : styles.empty;

  return (
    <span className={[styles.badge, stateClass].join(" ")}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
