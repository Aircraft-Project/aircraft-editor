"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EditorView } from "@/components/templates";

function EditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  return (
    <EditorView
      projectId={projectId}
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
