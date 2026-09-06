"use client";

import {
  Clock3,
  Ellipsis,
  ExternalLink,
  MonitorSmartphone,
  PencilLine,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  formatProjectUpdatedAt,
  type Project,
} from "@/modules/projects";

import {
  PROJECT_ACCENT_CLASS,
  PROJECT_ICON_MAP,
  PROJECT_STATUS_CONFIG,
} from "../projectVisualConfig";
import styles from "./ProjectCard.module.css";

export interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onEdit: (project: Project) => void;
  onMenu?: (project: Project) => void;
}

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onMenu,
}: ProjectCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const menuId = "project-menu-" + useId().replaceAll(":", "");
  const Icon = PROJECT_ICON_MAP[project.icon];
  const status = PROJECT_STATUS_CONFIG[project.status];

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !cardRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const openProject = (): void => {
    setIsMenuOpen(false);
    onOpen(project);
  };

  const editProject = (): void => {
    setIsMenuOpen(false);
    onEdit(project);
  };

  const toggleMenu = (): void => {
    setIsMenuOpen((current) => !current);
    onMenu?.(project);
  };

  return (
    <article className={styles.card} ref={cardRef}>
      <div className={styles.topRow}>
        <span
          className={styles.projectIcon}
          data-accent={PROJECT_ACCENT_CLASS[project.accent]}
          aria-hidden="true"
        >
          <Icon size={31} strokeWidth={2.1} />
        </span>

        <span
          className={styles.status}
          data-tone={status.tone}
        >
          <span aria-hidden="true" />
          {status.label}
        </span>

        <button
          className={styles.menuButton}
          type="button"
          aria-label={"Opciones de " + project.name}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          onClick={toggleMenu}
        >
          <Ellipsis size={22} aria-hidden="true" />
        </button>

        {isMenuOpen ? (
          <div
            className={styles.menu}
            id={menuId}
            role="menu"
          >
            <button type="button" role="menuitem" onClick={openProject}>
              <ExternalLink size={16} aria-hidden="true" />
              Abrir
            </button>
            <button type="button" role="menuitem" onClick={editProject}>
              <PencilLine size={16} aria-hidden="true" />
              Editar
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.copy}>
        <h2>{project.name}</h2>
        <p>{project.description}</p>
      </div>

      <div className={styles.meta}>
        <span>
          <MonitorSmartphone size={17} aria-hidden="true" />
          {project.screensCount}{" "}
          {project.screensCount === 1 ? "pantalla" : "pantallas"}
        </span>
        <span>
          <Clock3 size={17} aria-hidden="true" />
          {formatProjectUpdatedAt(project.updatedAt)}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.openButton}
          type="button"
          onClick={openProject}
        >
          <ExternalLink size={17} aria-hidden="true" />
          Abrir
        </button>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={"Editar " + project.name}
          onClick={editProject}
        >
          <PencilLine size={18} aria-hidden="true" />
        </button>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={"Más opciones de " + project.name}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          onClick={toggleMenu}
        >
          <Ellipsis size={20} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
