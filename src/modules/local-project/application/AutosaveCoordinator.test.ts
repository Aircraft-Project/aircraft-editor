/** @jest-environment node */

import { AutosaveCoordinator, type SaveState } from "./AutosaveCoordinator";

function deferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("AutosaveCoordinator", () => {
  it("coalesces pending writes for the same document", async () => {
    const first = jest.fn().mockResolvedValue(undefined);
    const latest = jest.fn().mockResolvedValue(undefined);
    const coordinator = new AutosaveCoordinator({ debounceMs: 1_000 });

    coordinator.schedule("layout:home", first);
    coordinator.schedule("layout:home", latest);
    await coordinator.flush();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toBe("SAVED");
  });

  it("serializes writes for one document and never lets an older write win", async () => {
    jest.useFakeTimers();
    const firstGate = deferred<void>();
    const order: string[] = [];
    const coordinator = new AutosaveCoordinator({ debounceMs: 10 });

    coordinator.schedule("layout:home", async () => {
      order.push("first:start");
      await firstGate.promise;
      order.push("first:end");
    });
    await jest.advanceTimersByTimeAsync(10);
    coordinator.schedule("layout:home", async () => {
      order.push("second");
    });
    await jest.advanceTimersByTimeAsync(10);

    expect(order).toEqual(["first:start"]);
    firstGate.resolve();
    await coordinator.flush();
    expect(order).toEqual(["first:start", "first:end", "second"]);
    jest.useRealTimers();
  });

  it("keeps a failed write pending for explicit retry", async () => {
    const states: SaveState[] = [];
    const write = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const coordinator = new AutosaveCoordinator({
      debounceMs: 1_000,
      onStateChange: (state) => states.push(state),
    });

    coordinator.schedule("settings", write);
    await expect(coordinator.flush()).rejects.toThrow("disk full");
    expect(coordinator.getState()).toBe("ERROR");

    await coordinator.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toBe("SAVED");
    expect(states).toEqual(
      expect.arrayContaining(["DIRTY", "SAVING", "ERROR", "SAVED"]),
    );
  });
});
