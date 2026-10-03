import { app, BrowserWindow, dialog, session } from "electron";
import path from "node:path";
import { registerLocalProjectIpc } from "./registerLocalProjectIpc";
import { AircraftWorkspaceBootstrap } from "../workspace/AircraftWorkspaceBootstrap";
import { resolveAircraftWorkspacePaths } from "../workspace/AircraftWorkspaceResolver";
import type { AircraftWorkspacePaths } from "../workspace/AircraftWorkspacePaths";

const DEFAULT_RENDERER_URL = "http://127.0.0.1:3000";
const WINDOW_BACKGROUND = "#020b1a";
const NET_ERROR_ABORTED = -3;

let mainWindow: BrowserWindow | null = null;
let aircraftWorkspacePaths: AircraftWorkspacePaths | null = null;

function resolveRendererUrl(): URL {
  const rendererUrl = new URL(
    process.env.AIRCRAFT_DESKTOP_URL ?? DEFAULT_RENDERER_URL,
  );
  const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(
    rendererUrl.hostname,
  );

  if (!isLoopback || !["http:", "https:"].includes(rendererUrl.protocol)) {
    throw new Error(
      "AIRCRAFT_DESKTOP_URL must use HTTP(S) on a loopback host.",
    );
  }

  return rendererUrl;
}

async function initializeAircraftWorkspace(): Promise<AircraftWorkspacePaths> {
  if (aircraftWorkspacePaths) return aircraftWorkspacePaths;

  const paths = resolveAircraftWorkspacePaths(app.getPath("home"));
  await new AircraftWorkspaceBootstrap().bootstrap(paths);
  aircraftWorkspacePaths = paths;

  if (!app.isPackaged) {
    console.info("[workspace] root=" + paths.root);
    console.info("[workspace] config=" + paths.config);
    console.info("[workspace] security=" + paths.security);
    console.info("[workspace] localProjects=" + paths.localProjects);
  }

  return paths;
}

function configureSessionSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
}

async function createMainWindow(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const rendererUrl = resolveRendererUrl();
  const allowedOrigin = rendererUrl.origin;
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "Aircraft Editor",
    backgroundColor: WINDOW_BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });

  mainWindow = window;

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) window.show();
  });

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("Aircraft Editor");
  });
  window.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      if (new URL(targetUrl).origin !== allowedOrigin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== NET_ERROR_ABORTED) {
        console.error(
          "[desktop] Failed to load " +
            validatedUrl +
            ": " +
            errorDescription +
            " (" +
            errorCode +
            ").",
        );
      }
    },
  );

  window.webContents.once("did-finish-load", () => {
    console.info(
      "[desktop] Aircraft Editor loaded from " +
        rendererUrl.origin +
        ".",
    );
  });

  try {
    await window.loadURL(rendererUrl.toString());
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown load error";
    console.error(
      "[desktop] Unable to load Aircraft Editor: " + message,
    );
    dialog.showErrorBox(
      "Aircraft Editor",
      "No se pudo cargar Aircraft Editor desde " +
        rendererUrl.origin +
        ". Verifica que el servidor Next esté disponible.",
    );
    if (!window.isDestroyed()) window.destroy();
    app.quit();
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    void createMainWindow();
  });

  app.whenReady()
    .then(async () => {
      await initializeAircraftWorkspace();
      configureSessionSecurity();
      // Phase 1.5.4A transition: encrypted project storage remains under
      // userData. Phases 1.5.4B/1.5.4C will migrate security and local-project roots.
      registerLocalProjectIpc(app.getPath("userData"));
      await createMainWindow();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          void createMainWindow();
        }
      });
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown startup error";
      console.error("[desktop] Electron startup failed: " + message);
      app.quit();
    });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
