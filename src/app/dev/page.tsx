import Link from "next/link";
import styles from "../page.module.css";

/**
 * Checklist basado en el scope V1 del PRD (§8.1, F-01..F-11).
 * "done" acá significa "esqueleto de UI listo", no lógica de dominio real
 * (no hay AST, TriggerGraph, SchemaProvider ni persistencia todavía).
 */
const checklist: Array<{ id: string; label: string; done: boolean }> = [
  { id: "F-02", label: "Gestión de proyectos — Vista de Proyectos (demo estático)", done: true },
  { id: "F-03", label: "Gestión de pantallas — Carrusel inferior (demo estático)", done: true },
  { id: "F-04", label: "Layout Mode — jerarquía visual (AST Node atoms/molecules)", done: true },
  { id: "F-07", label: "Trigger Graph Mode — tablero con @xyflow/react (demo)", done: true },
  { id: "F-09", label: "Navegación Layout ↔ Trigger Graph (Zustand store)", done: true },
  { id: "F-05", label: "Drag & drop real desde la paleta al canvas (Column/Row/weight)", done: true },
  { id: "F-06", label: "Inspector conectado a un AST real (nombre y weight editables)", done: true },
  { id: "F-08", label: "Edición real de vértices/aristas del Trigger Graph", done: false },
  { id: "F-10", label: "Validación en tiempo real (Validator del core KMP)", done: false },
  { id: "F-11", label: "Persistencia local (localStorage / IndexedDB)", done: false },
];

export default function DevelopmentPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <span className={styles.badge}>assembler-ide-frontend · dev</span>
        <h1 className={styles.title}>Assembler IDE</h1>
        <p className={styles.subtitle}>
          Plataforma web no-code para construir apps Aircraft: pantallas compuestas visualmente y lógica
          definida mediante un grafo de triggers, sin editar YAML a mano.
        </p>

        <div className={styles.actions}>
          <Link href="/design-gallery" className={`${styles.link} ${styles.linkPrimary}`}>
            Galería de diseño →
          </Link>
          <Link href="/projects" className={`${styles.link} ${styles.linkSecondary}`}>
            Vista de Proyectos (demo)
          </Link>
          <Link href="/editor" className={`${styles.link} ${styles.linkSecondary}`}>
            Vista de Edición (demo)
          </Link>
        </div>

        <h2 className={styles.sectionTitle}>Próximos pasos</h2>
        <p className={styles.sectionSubtitle}>Scope V1 del PRD (§8.1) — estado del esqueleto de frontend.</p>

        <div className={styles.checklist}>
          {checklist.map((item) => (
            <div key={item.id} className={`${styles.item} ${item.done ? styles.itemDone : styles.itemPending}`}>
              <span
                className={styles.itemDot}
                style={{ background: item.done ? "var(--success)" : "var(--border-strong)" }}
              />
              <span className={styles.itemId}>{item.id}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
