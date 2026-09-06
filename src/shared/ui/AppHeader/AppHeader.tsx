"use client";

import { Bell, Search } from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";

import { UserMenu } from "../UserMenu";
import styles from "./AppHeader.module.css";

export interface AppHeaderProps {
  displayName: string;
  roleLabel: string;
  initials: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onLogout: () => void;
}

export function AppHeader({
  displayName,
  roleLabel,
  initials,
  searchQuery,
  onSearchChange,
  onLogout,
}: AppHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (
        event.key.toLocaleLowerCase() === "k" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    onSearchChange(event.target.value);
  };

  return (
    <div className={styles.header}>
      <div className={styles.brand} aria-label="Aircraft">
        <Image
          src="/assets/branding/aircraft-mark.svg"
          width={42}
          height={42}
          alt=""
          aria-hidden="true"
          priority
        />
        <span>Aircraft</span>
      </div>

      <label className={styles.search}>
        <span className={styles.srOnly}>Buscar proyectos</span>
        <Search size={20} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Buscar proyectos..."
          autoComplete="off"
        />
        <kbd aria-hidden="true">Ctrl K</kbd>
      </label>

      <div className={styles.actions}>
        <button
          className={styles.notification}
          type="button"
          aria-label="Ver notificaciones"
        >
          <Bell size={21} aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <UserMenu
          displayName={displayName}
          roleLabel={roleLabel}
          initials={initials}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}
