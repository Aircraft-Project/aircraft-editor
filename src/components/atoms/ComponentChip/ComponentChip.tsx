import { HTMLAttributes } from "react";
import { ComponentType, getComponentTypeColor } from "@/design/tokens";
import styles from "./ComponentChip.module.css";

type ComponentChipProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
  type: ComponentType;
  subtype: string;
  draggable?: boolean;
};

export function ComponentChip({
  type,
  subtype,
  draggable,
  ...props
}: ComponentChipProps) {
  const color = getComponentTypeColor(type);
  const initial = type.slice(0, 1).toUpperCase();

  return (
    <div
      {...props}
      draggable={draggable}
      className={[styles.chip, props.className].filter(Boolean).join(" ")}
    >
      <span className={styles.icon} style={{ color }}>
        {initial}
      </span>
      <span className={styles.label}>
        {type} / {subtype}
      </span>
    </div>
  );
}
