let activeFlush: (() => Promise<void>) | null = null;

export function registerActiveProjectFlush(
  flush: () => Promise<void>,
): () => void {
  activeFlush = flush;
  return () => {
    if (activeFlush === flush) activeFlush = null;
  };
}

export function flushActiveProjectWrites(): Promise<void> | null {
  return activeFlush?.() ?? null;
}
