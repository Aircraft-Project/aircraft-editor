# Aircraft Editor Desktop — Phase 1

Electron currently wraps the existing Next.js application. It does not replace or statically export the renderer.

## Commands

- Web development: `npm run dev`
- Desktop development: `npm run electron:dev`
- Compile Electron main/preload only: `npm run electron:build`
- Verify the installed Electron runtime: `npm run electron:check`

`electron:dev` compiles the desktop process, starts Next on `127.0.0.1:3000`, waits until the server responds, and then opens Electron. Set `AIRCRAFT_DESKTOP_PORT` to use another port. The web-only `dev` command remains unchanged.

## Security boundary

The BrowserWindow uses context isolation, sandboxing and web security with Node integration disabled. The preload currently exposes no renderer API. Future desktop capabilities must be added as explicit, typed APIs instead of exposing Node.js or unrestricted IPC.

## Phase 1 limitation

This phase does not create an installer or a completely self-contained production executable. Aircraft Editor currently uses Next.js Server Components and Route Handlers, so Electron requires a running Next server. Packaging that server and managing its lifecycle belongs to a later desktop distribution phase; static export is intentionally not used.

Aircraft Engine, aircraft-android, JVM/JRE, SchemaProvider, Assembler, hardware access, filesystem APIs, auto-update and unrestricted IPC are not included.
