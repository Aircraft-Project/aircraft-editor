"use client";

import { useRouter } from "next/navigation";
import { ProjectsView, type ProjectSummary } from "@/components/templates";

const demoProjects: ProjectSummary[] = [
  { id: "ecommerce", name: "Mi App E-Commerce", screenCount: 3, editedLabel: "hoy" },
  { id: "onboarding", name: "Prototipo Onboarding", screenCount: 5, editedLabel: "hace 2d" },
];

export default function ProjectsPage() {
  const router = useRouter();

  return (
    <ProjectsView
      projects={demoProjects}
      onOpenProject={() => router.push("/editor")}
      onNewProject={() => router.push("/editor")}
    />
  );
}
