"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { BodyNode } from "@/modules/screens/layoutTree";
import { DevicePreview } from "../DevicePreview";
import styles from "./PreviewDialog.module.css";

interface PreviewDialogProps {
  readonly body: BodyNode;
  readonly devicePresetId: string;
  readonly screenName: string;
  readonly onClose: () => void;
  readonly returnFocus: () => void;
}

export function PreviewDialog({
  body,
  devicePresetId,
  screenName,
  onClose,
  returnFocus,
}: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return () => {
      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      }
      returnFocus();
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby="editor-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id="editor-preview-title">Vista previa</h2>
          <p>{screenName}</p>
        </div>
        <button type="button" aria-label="Cerrar vista previa" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className={styles.content}>
        <DevicePreview
          body={body}
          devicePresetId={devicePresetId}
          screenName={screenName}
          zoom={78}
        />
      </div>
    </dialog>
  );
}
