"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { ComponentChip } from "@/components/atoms";
import { paletteByType, quickItems } from "./paletteCatalog";
import styles from "./LeftPanel.module.css";

type LeftPanelProps = {
  /** Deshabilitada visualmente en Trigger Graph Mode (PRD §7.1). */
  disabled?: boolean;
};

export function LeftPanel({ disabled }: LeftPanelProps) {
  const types = Object.keys(paletteByType) as Array<keyof typeof paletteByType>;
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Button"]));

  const toggleSection = (type: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <aside className={[styles.panel, disabled ? styles.disabled : ""].filter(Boolean).join(" ")}>
      <div className={styles.title}>COMPONENTES</div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>RÁPIDOS</div>
        <div className={styles.sectionItems}>
          {quickItems.map((item) => (
            <ComponentChip key={`${item.type}-${item.subtype}`} type={item.type} subtype={item.subtype} draggable />
          ))}
        </div>
      </div>

      {types.map((type) => {
        const isOpen = openSections.has(type);
        return (
          <div key={type} className={styles.section}>
            <button type="button" className={styles.sectionHeader} onClick={() => toggleSection(type)}>
              {type}
              {isOpen ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
            </button>
            {isOpen ? (
              <div className={styles.sectionItems}>
                {paletteByType[type].map((subtype) => (
                  <ComponentChip key={subtype} type={type} subtype={subtype} draggable />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}
