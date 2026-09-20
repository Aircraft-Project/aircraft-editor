export type SaveState = "SAVED" | "DIRTY" | "SAVING" | "ERROR";

export interface AutosaveCoordinatorOptions {
  readonly debounceMs?: number;
  readonly onStateChange?: (state: SaveState) => void;
}

export class AutosaveCoordinator {
  private readonly debounceMs: number;
  private readonly onStateChange: (state: SaveState) => void;
  private readonly pending = new Map<string, () => Promise<void>>();
  private readonly timers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly running = new Map<string, Promise<void>>();
  private state: SaveState = "SAVED";

  constructor(options: AutosaveCoordinatorOptions = {}) {
    this.debounceMs = options.debounceMs ?? 750;
    this.onStateChange = options.onStateChange ?? (() => undefined);
  }

  getState(): SaveState {
    return this.state;
  }

  schedule(documentKey: string, write: () => Promise<void>): void {
    this.pending.set(documentKey, write);
    const timer = this.timers.get(documentKey);
    if (timer) clearTimeout(timer);
    this.setState("DIRTY");
    this.timers.set(
      documentKey,
      setTimeout(() => {
        this.timers.delete(documentKey);
        void this.persist(documentKey).catch(() => undefined);
      }, this.debounceMs),
    );
  }

  async flush(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.all(
      [...this.pending.keys()].map((key) => this.persist(key)),
    );
    await Promise.all(this.running.values());
    if (this.pending.size === 0 && this.state !== "ERROR") {
      this.setState("SAVED");
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private persist(documentKey: string): Promise<void> {
    const previous = this.running.get(documentKey) ?? Promise.resolve();
    let failed = false;
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        const write = this.pending.get(documentKey);
        if (!write) return;
        this.pending.delete(documentKey);
        this.setState("SAVING");
        try {
          await write();
        } catch (error) {
          failed = true;
          if (!this.pending.has(documentKey)) {
            this.pending.set(documentKey, write);
          }
          this.setState("ERROR");
          throw error;
        }
      })
      .finally(() => {
        if (this.running.get(documentKey) === operation) {
          this.running.delete(documentKey);
        }
        if (
          this.pending.has(documentKey) &&
          !this.timers.has(documentKey) &&
          !failed
        ) {
          void this.persist(documentKey).catch(() => undefined);
          return;
        }
        if (
          this.pending.size === 0 &&
          this.running.size === 0 &&
          this.state !== "ERROR"
        ) {
          this.setState("SAVED");
        }
      });
    this.running.set(documentKey, operation);
    return operation;
  }

  private setState(state: SaveState): void {
    if (this.state === state) return;
    this.state = state;
    this.onStateChange(state);
  }
}
