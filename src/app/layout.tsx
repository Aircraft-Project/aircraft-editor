import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aircraft Editor",
  description: "Editor visual para diseñar y crear aplicaciones multiplataforma con Aircraft.",
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
