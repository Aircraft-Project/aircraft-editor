import { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "style"> & {
  label?: string;
};

export function Select({ label, id, children, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const select = (
    <select id={selectId} {...props} className={styles.select}>
      {children}
    </select>
  );

  if (!label) {
    return select;
  }

  return (
    <label htmlFor={selectId} className={styles.field}>
      <span className={styles.label}>{label}</span>
      {select}
    </label>
  );
}
