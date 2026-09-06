"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./UserMenu.module.css";

export interface UserMenuProps {
  displayName: string;
  roleLabel: string;
  initials: string;
  onLogout: () => void;
}

export function UserMenu({
  displayName,
  roleLabel,
  initials,
  onLogout,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const triggerId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    logoutRef.current?.focus();

    const handlePointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = (): void => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        id={triggerId}
        className={styles.trigger}
        type="button"
        aria-label={`${isOpen ? "Cerrar" : "Abrir"} menú de usuario de ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.userText}>
          <strong>{displayName}</strong>
          <small>{roleLabel}</small>
        </span>
        <span
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        >
          <ChevronDown size={18} />
        </span>
      </button>

      {isOpen ? (
        <ul
          id={menuId}
          className={styles.menu}
          role="menu"
          aria-labelledby={triggerId}
        >
          <li role="none">
            <button
              ref={logoutRef}
              className={styles.menuItem}
              type="button"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
