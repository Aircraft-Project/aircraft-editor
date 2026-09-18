import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const port = readIntegerEnvironmentVariable(
  "AIRCRAFT_DESKTOP_PORT",
  3000,
  1,
  65_535,
);
const startupTimeoutMs = readIntegerEnvironmentVariable(
  "AIRCRAFT_DESKTOP_STARTUP_TIMEOUT_MS",
  60_000,
  1_000,
  300_000,
);
const rendererUrl = `http://127.0.0.1:${port}`;
const nextCli = path.join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const electronExecutable = require("electron");

let nextProcess;
let electronProcess;
let shuttingDown = false;

function readIntegerEnvironmentVariable(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

function stopProcessTree(childProcess) {
  if (!childProcess?.pid || childProcess.exitCode !== null) return;

  if (process.platform === "win32") {
    spawnSync(
      "taskkill",
      ["/pid", String(childProcess.pid), "/t", "/f"],
      { stdio: "ignore", windowsHide: true },
    );
    return;
  }

  childProcess.kill("SIGTERM");
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcessTree(electronProcess);
  stopProcessTree(nextProcess);
  process.exit(exitCode);
}

async function waitForRenderer() {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    if (nextProcess.exitCode !== null) {
      throw new Error(
        `Next exited before becoming available (code ${nextProcess.exitCode ?? "unknown"}).`,
      );
    }

    try {
      const response = await fetch(rendererUrl, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next is still starting. The bounded loop reports a clear timeout below.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Next did not become available at ${rendererUrl} within ${startupTimeoutMs}ms.`,
  );
}

async function main() {
  console.info(`[desktop] Starting Next development server at ${rendererUrl}.`);
  nextProcess = spawn(
    process.execPath,
    [nextCli, "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: "inherit",
      windowsHide: true,
    },
  );

  nextProcess.once("error", (error) => {
    console.error(`[desktop] Failed to start Next: ${error.message}`);
    shutdown(1);
  });

  await waitForRenderer();
  console.info("[desktop] Next is ready. Starting Electron.");

  electronProcess = spawn(electronExecutable, [projectRoot], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AIRCRAFT_DESKTOP_URL: rendererUrl,
      NODE_ENV: "development",
    },
    stdio: "inherit",
    windowsHide: false,
  });

  electronProcess.once("error", (error) => {
    console.error(`[desktop] Failed to start Electron: ${error.message}`);
    shutdown(1);
  });

  electronProcess.once("exit", (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });

  nextProcess.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[desktop] Next stopped unexpectedly (code ${code ?? "unknown"}).`);
      shutdown(code ?? 1);
    }
  });
}

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`[desktop] ${message}`);
  shutdown(1);
});
