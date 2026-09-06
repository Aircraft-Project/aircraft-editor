import type { ReactNode } from "react";

import styles from "./AppShell.module.css";

export interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShell({
  header,
  sidebar,
  children,
  className,
}: AppShellProps) {
  const shellClassName = className
    ? styles.shell + " " + className
    : styles.shell;

  return (
    <div className={shellClassName}>
      <header className={styles.header}>{header}</header>
      <aside className={styles.sidebar}>{sidebar}</aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
