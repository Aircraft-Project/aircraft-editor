import { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  const variantClass = styles[variant];
  const hasIcon = Boolean(leftIcon || rightIcon);

  const className = [styles.button, variantClass, size === "sm" ? styles.sm : "", props.className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      className={className}
    >
      {leftIcon ? <span className={styles.icon} aria-hidden>{leftIcon}</span> : null}
      {children ? <span className={hasIcon ? styles.labelWithIcon : styles.label}>{children}</span> : null}
      {rightIcon ? <span className={styles.icon} aria-hidden>{rightIcon}</span> : null}
    </button>
  );
}
