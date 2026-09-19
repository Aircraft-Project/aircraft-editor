"use client";

import Image from "next/image";
import {
  Boxes,
  FolderOpen,
  MonitorSmartphone,
  Workflow,
} from "lucide-react";
import type { EditorWorkspace } from "../../domain";
import styles from "./EditorNavigation.module.css";

interface EditorNavigationProps {
  readonly activeWorkspace: EditorWorkspace;
  readonly onChange: (workspace: EditorWorkspace) => void;
}

const items = [
  { id: "components", label: "Componentes", icon: Boxes },
  { id: "screens", label: "Pantallas", icon: MonitorSmartphone },
  { id: "triggers", label: "Triggers", icon: Workflow },
  { id: "resources", label: "Recursos", icon: FolderOpen },
] as const;

export function EditorNavigation({
  activeWorkspace,
  onChange,
}: EditorNavigationProps) {
  return (
    <nav className={styles.navigation} aria-label="Módulos del Editor">
      {items.map(({ id, label, icon: Icon }) => {
        const active = activeWorkspace === id;
        return (
          <button
            key={id}
            type="button"
            className={[styles.item, active ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            <Icon aria-hidden="true" size={21} />
            <span>{label}</span>
          </button>
        );
      })}
      <div className={styles.brand}>
        <Image
          src="/assets/branding/aircraft-mark.svg"
          alt=""
          aria-hidden="true"
          width={54}
          height={54}
        />
        <strong>Aircraft Editor</strong>
        <span>Convierte tus ideas en aplicaciones reales.</span>
      </div>
    </nav>
  );
}
