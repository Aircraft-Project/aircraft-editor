import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class AtomicFileStore {
  async read(filePath: string): Promise<Uint8Array> {
    const handle = await open(filePath, "r");
    try {
      return new Uint8Array(await handle.readFile());
    } finally {
      await handle.close();
    }
  }

  async write(filePath: string, bytes: Uint8Array): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const suffix = randomUUID();
    const temporaryPath = filePath + ".tmp-" + suffix;
    const backupPath = filePath + ".bak-" + suffix;
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      await handle.close();
      await rm(temporaryPath, { force: true });
      throw error;
    }
    await handle.close();

    try {
      await rename(temporaryPath, filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST" && code !== "EPERM") {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    }

    let previousMoved = false;
    try {
      await rename(filePath, backupPath);
      previousMoved = true;
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (previousMoved) {
        await rename(backupPath, filePath).catch(() => undefined);
      }
      throw error;
    }
    await rm(backupPath, { force: true }).catch(() => undefined);
  }
}
