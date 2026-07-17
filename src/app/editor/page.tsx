"use client";

import { useRouter } from "next/navigation";
import { EditorView } from "@/components/templates";

export default function EditorPage() {
  const router = useRouter();

  return <EditorView projectName="Mi App E-Commerce" onBackToProjects={() => router.push("/projects")} />;
}
