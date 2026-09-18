"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";

import styles from "./AircraftLoadingOverlay.module.css";

export interface AircraftLoadingOverlayProps {
  open: boolean;
  title?: string;
  description?: string;
}

export function AircraftLoadingOverlay({
  open,
  title = "Procesando...",
  description = "Por favor espera un momento.",
}: AircraftLoadingOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }

      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => event.preventDefault()}
    >
      <section
        ref={panelRef}
        className={styles.panel}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
        tabIndex={-1}
      >
        <div className={styles.visual} aria-hidden="true">
          <span className={`${styles.orbit} ${styles.orbitOuter}`}>
            <i className={styles.dotLarge} />
            <i className={styles.dotSmall} />
          </span>
          <span className={`${styles.orbit} ${styles.orbitInner}`}>
            <i className={styles.dotMedium} />
            <i className={styles.dotTiny} />
          </span>
          <span className={styles.coreGlow} />
          <span className={styles.markShell}>
            <Image
              src="/assets/branding/aircraft-mark.svg"
              alt=""
              width={112}
              height={112}
              className={styles.mark}
              priority
            />
          </span>
        </div>

        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
      </section>
    </dialog>
  );
}
