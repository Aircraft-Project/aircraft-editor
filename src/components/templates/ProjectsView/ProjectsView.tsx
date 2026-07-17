"use client";

import styles from "./ProjectsView.module.css";

export type ProjectSummary = {
  id: string;
  name: string;
  screenCount: number;
  editedLabel: string;
};

type ProjectsViewProps = {
  projects: ProjectSummary[];
  onOpenProject: (id: string) => void;
  onNewProject?: () => void;
};

export function ProjectsView({ projects, onOpenProject, onNewProject }: ProjectsViewProps) {
  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoBadge}>A</span>
          Assembler IDE
        </div>
        <div className={styles.avatar} />
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Mis Proyectos</h1>

        <div className={styles.grid}>
          {projects.map((project) => (
            <div key={project.id} className={styles.card} onClick={() => onOpenProject(project.id)}>
              <div className={styles.cardName}>{project.name}</div>
              <div className={styles.cardMeta}>{project.screenCount} pantallas</div>
              <div className={styles.cardMeta}>Editado: {project.editedLabel}</div>
            </div>
          ))}

          <div className={styles.newCard} onClick={onNewProject}>
            + Nuevo Proyecto
          </div>
        </div>
      </main>
    </div>
  );
}
