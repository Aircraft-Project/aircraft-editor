import Link from "next/link";
import {
  FolderKanban,
  LayoutTemplate,
  Settings,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import styles from "./AppSidebar.module.css";

interface DisabledNavigationItem {
  label: string;
  icon: LucideIcon;
}

const disabledItems: readonly DisabledNavigationItem[] = [
  { label: "Plantillas", icon: LayoutTemplate },
  { label: "Recursos", icon: Wrench },
  { label: "Equipo", icon: UsersRound },
  { label: "Ajustes", icon: Settings },
];

export function AppSidebar() {
  return (
    <nav className={styles.navigation} aria-label="Navegación principal">
      <Link
        className={styles.activeItem}
        href="/projects"
        aria-current="page"
      >
        <FolderKanban size={23} aria-hidden="true" />
        <span>Proyectos</span>
      </Link>

      {disabledItems.map(({ label, icon: Icon }) => (
        <button
          className={styles.item}
          type="button"
          disabled
          aria-disabled="true"
          title={label + " — Próximamente"}
          key={label}
        >
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
