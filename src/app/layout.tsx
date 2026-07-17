import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assembler IDE",
  description: "Herramienta visual para construir apps Aircraft — layout y trigger graphs sin YAML",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
