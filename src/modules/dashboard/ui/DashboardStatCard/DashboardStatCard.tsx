import {
  Layers3,
  PencilLine,
  Send,
  type LucideIcon,
} from "lucide-react";

import styles from "./DashboardStatCard.module.css";

export type DashboardStatKind =
  | "TOTAL"
  | "EDITING"
  | "PUBLISHED";

export interface DashboardStatCardProps {
  kind: DashboardStatKind;
  value: number;
  label: string;
}

const STAT_ICON_MAP: Readonly<
  Record<DashboardStatKind, LucideIcon>
> = {
  TOTAL: Layers3,
  EDITING: PencilLine,
  PUBLISHED: Send,
};

export function DashboardStatCard({
  kind,
  value,
  label,
}: DashboardStatCardProps) {
  const Icon = STAT_ICON_MAP[kind];

  return (
    <article
      className={styles.card}
      data-kind={kind.toLocaleLowerCase()}
      aria-label={label + ": " + value}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={30} strokeWidth={2.15} />
      </span>
      <span className={styles.content}>
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
      <svg
        className={styles.sparkline}
        viewBox="0 0 116 44"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 38 C18 38 20 8 40 14 S58 34 74 20 93 6 116 9" />
      </svg>
    </article>
  );
}
