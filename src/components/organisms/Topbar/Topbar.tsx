import styles from "./Topbar.module.css";

type TopbarProps = {
  projectName: string;
  onBack?: () => void;
  saved?: boolean;
};

export function Topbar({ projectName, onBack, saved = true }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.logo}>A</div>
        {onBack ? (
          <button type="button" className={styles.back} onClick={onBack}>
            ‹ Mis Proyectos
          </button>
        ) : null}
        <span className={styles.divider}>|</span>
        <span className={styles.projectName}>{projectName}</span>
      </div>

      <div className={styles.status}>
        <span className={styles.statusDot} style={{ background: saved ? "var(--success)" : "var(--warning)" }} />
        {saved ? "Guardado" : "Guardando…"}
      </div>
    </header>
  );
}
