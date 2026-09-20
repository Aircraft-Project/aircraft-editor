"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EditorView } from "@/components/templates";
import type { ProjectSource } from "@/modules/local-project";

function EditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  const sourceParam = searchParams.get("source");
  const source: ProjectSource =
    sourceParam === "LOCAL" ? "LOCAL" : "CLOUD";

  return (
    <EditorView
      projectId={projectId}
      source={source}
      onBackToProjects={() => router.push("/projects")}
    />
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageContent />
    </Suspense>
  );
}
