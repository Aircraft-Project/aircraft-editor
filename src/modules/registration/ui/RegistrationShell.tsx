"use client";

import Image from "next/image";
import { Grid2X2, UsersRound, Zap } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./Registration.module.css";

type RegistrationShellProps = { children: ReactNode };

const BENEFITS = [
  { icon: Grid2X2, title: "Diseño visual", description: "Crea pantallas y flujos sin escribir código." },
  { icon: Zap, title: "Mayor productividad", description: "Acelera el desarrollo de tus aplicaciones." },
  { icon: UsersRound, title: "Trabajo en equipo", description: "Colabora y lleva tus ideas más lejos." },
] as const;

export function RegistrationShell({ children }: RegistrationShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <aside className={styles.brandPanel} aria-label="Aircraft Editor">
        <Image
          src="/assets/branding/aircraft-logo.svg"
          alt="Aircraft Editor"
          width={350}
          height={184}
          priority
          className={styles.brandLogo}
        />
        <div className={styles.brandCopy}>
          <h1>Crea. Diseña.<br />Construye <span>sin límites.</span></h1>
          <p>Únete a Aircraft Editor y empieza a crear experiencias digitales increíbles de forma visual, rápida y segura.</p>
        </div>
        <div className={styles.benefits}>
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <div className={styles.benefit} key={title}>
              <span className={styles.benefitIcon}><Icon aria-hidden="true" /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </div>
          ))}
        </div>
        <div className={styles.brandMark} aria-hidden="true">
          <Image src="/assets/branding/aircraft-mark.svg" alt="" width={520} height={520} />
        </div>
        <blockquote>“Las grandes ideas también se construyen<br />con mejores herramientas.”<i /></blockquote>
      </aside>
      <section className={styles.formPanel}>{children}</section>
    </main>
  );
}
