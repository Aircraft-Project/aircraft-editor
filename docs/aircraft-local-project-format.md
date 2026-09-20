# Aircraft local project format v1

Aircraft Editor stores each desktop project as an independent, encrypted directory under Electron `userData`. Structured documents use MessagePack; resources keep their original bytes. The renderer never receives physical paths and never calls Node filesystem APIs.

## Quick path

1. Electron resolves `<userData>/local-projects`.
2. A stable session `user.id` selects `users/<sha256(ownerId)>`.
3. Each project is loaded from `projects/<projectId>` and decrypted with its own derived key.
4. Editor stores hydrate from granular documents; autosave writes only affected documents.
5. Resource bytes are addressed by SHA-256 and remain outside the resource manifest.

## Scope and invariants

| Topic | Version 1 decision |
|---|---|
| Project format | `projectFormatVersion = 1` |
| Document version | `documentVersion = 1` |
| Structured codec | MessagePack via `@msgpack/msgpack` |
| Resource codec | Raw original bytes |
| Encryption | AES-256-GCM with a fresh 12-byte nonce on every write |
| Authentication tag | 16 bytes; header is authenticated as AAD |
| Master key | Random 32-byte installation secret protected by Electron `safeStorage` |
| Key separation | HKDF-SHA256 per owner, then per project |
| Owner directory | SHA-256 of stable `ownerId`; it is an identifier, not an encryption key |
| Resource identity | SHA-256 of original bytes, scoped to one project |
| Writes | Temporary file, flush/sync, rename; Windows replacement uses backup/restore |
| Project listing | Directory scan; decrypt root manifest + metadata and count `*.airscreen` filenames only |

Local storage fails closed when `safeStorage.isEncryptionAvailable()` is false. Aircraft does not write an unencrypted fallback.

## Physical structure

```text
<userData>/
└── local-projects/
    ├── .master-key
    └── users/
        └── <sha256(ownerId)>/
            └── projects/
                └── <projectId>/
                    ├── .aircraft
                    ├── metadata/
                    │   └── project.airmeta
                    ├── screens/
                    │   └── <screenId>.airscreen
                    ├── layouts/
                    │   └── <screenId>.airlayout
                    ├── triggers/
                    │   └── <screenId>.airgraph
                    ├── resources/
                    │   ├── manifest.airres
                    │   └── <sha256>.airblob
                    └── settings/
                        └── project.airsettings
```

Every `projectId`, `screenId`, and resource ID used to construct a path must match `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`. Renderer input can never select a physical path.

## File responsibilities

| File | Document type | Payload |
|---|---:|---|
| `.aircraft` | 1 | `ProjectManifest` |
| `project.airmeta` | 2 | `ProjectMetadata` |
| `*.airscreen` | 3 | `ScreenDocument` |
| `*.airlayout` | 4 | `LayoutDocument` |
| `*.airgraph` | 5 | `TriggerGraphDocument` |
| `manifest.airres` | 6 | `ResourceManifest` |
| `project.airsettings` | 7 | `ProjectSettingsDocument` |
| `*.airblob` | 8 | Original resource bytes |

Extensions aid recognition; they do not provide security. Every file has an authenticated Aircraft envelope.

## Binary envelope

All persisted files use this layout:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 8 | ASCII magic `AIRCRFT1` |
| 8 | 1 | Envelope version (`1`) |
| 9 | 1 | Document type (`1..8`) |
| 10 | 2 | Project format version, unsigned big-endian (`1`) |
| 12 | 1 | Encryption version (`1` = AES-256-GCM) |
| 13 | 1 | Payload encoding (`1` = MessagePack, `2` = raw bytes) |
| 14 | 12 | Random GCM nonce |
| 26 | variable | Ciphertext |
| end - 16 | 16 | GCM authentication tag |

Bytes `0..13` are AES-GCM additional authenticated data. Changing the header, ciphertext, or tag makes decryption fail. The header contains only technical format metadata—never owner ID, project name, component text, resource name, or keys.

## Serialization

Structured domain values are encoded with MessagePack before encryption:

```text
Typed document → MessagePack → AES-256-GCM envelope → atomic file write
```

Resources do not use MessagePack or Base64:

```text
File.arrayBuffer() → Uint8Array → SHA-256 → AES-256-GCM envelope → <sha256>.airblob
```

Reading reverses those steps. Decrypted resource bytes must equal the original byte-for-byte.

## Keys and cryptographic separation

```text
random installation master key (32 bytes)
  └─ safeStorage.encryptString(base64(masterKey)) → .master-key
      └─ HKDF-SHA256(salt = UTF-8 ownerId, info = "aircraft:user:v1")
          └─ 32-byte owner key
              └─ HKDF-SHA256(salt = UTF-8 projectId, info = "aircraft:project:v1")
                  └─ 32-byte project key → AES-256-GCM
```

`ownerId` and `projectId` provide HKDF separation but are not secrets and are never used directly as AES keys. Keys and decrypted project payloads must not be logged.

### Desktop identity trust boundary

Phase 1.5.3 provides physical namespace isolation (the owner hash) and cryptographic key separation (owner/project HKDF domains). It does **not** yet provide a strong authorization boundary against a compromised Renderer: the current mock-auth session supplies `ownerId` through the restricted IPC contract, and Electron Main validates its shape rather than independently authenticating it. A future Main-owned, verifiable session must bind the effective owner and remove caller-selected `ownerId` from per-operation requests. This limitation does not weaken encryption at rest, but it must not be described as authorization.

## Logical payload examples

The examples below are readable representations of the typed payloads. Disk files contain encrypted binary data, not JSON.

### ProjectManifest — `.aircraft`

```json
{
  "documentVersion": 1,
  "projectId": "a4d0d1d7-75b2-42ad-91c7-86f985a5447b",
  "ownerId": "usr-admin-001",
  "projectFormatVersion": 1,
  "schemaVersion": "snapshot-1",
  "schemaSourceRevision": "aircraft-android-revision",
  "createdAt": "2026-09-19T15:00:00.000Z",
  "updatedAt": "2026-09-19T15:04:00.000Z"
}
```

The schema values come from `SchemaProvider.getManifest()` when a project is created.

### ProjectMetadata — `metadata/project.airmeta`

```json
{
  "documentVersion": 1,
  "projectId": "a4d0d1d7-75b2-42ad-91c7-86f985a5447b",
  "name": "Proyecto Local Demo",
  "description": "Aircraft desktop project",
  "status": "DRAFT",
  "icon": "LAYOUT",
  "accent": "BLUE",
  "createdAt": "2026-09-19T15:00:00.000Z",
  "updatedAt": "2026-09-19T15:04:00.000Z",
  "source": "LOCAL",
  "syncState": "LOCAL_ONLY"
}
```

### ScreenDocument — `screens/<screenId>.airscreen`

```json
{
  "documentVersion": 1,
  "screenId": "screen-home",
  "name": "Home",
  "description": "Pantalla principal",
  "context": "interface",
  "isInitial": true,
  "order": 0
}
```

Screen documents contain screen metadata only. Layout structure lives separately.

### LayoutDocument — `layouts/<screenId>.airlayout`

```json
{
  "documentVersion": 1,
  "screenId": "screen-home",
  "tree": {
    "id": "body-home",
    "kind": "body",
    "columns": [
      {
        "id": "column-main",
        "kind": "column",
        "weight": 1,
        "rows": []
      }
    ]
  }
}
```

The `tree` is the current Editor `BodyNode`. Component IDs, technical component types such as `Button`, subtypes, and properties are preserved inside row/component nodes. Friendly labels are presentation-only.

### TriggerGraphDocument — `triggers/<screenId>.airgraph`

```json
{
  "documentVersion": 1,
  "screenId": "screen-home",
  "graphs": {
    "screen-home:button-main:on-clic-event": {
      "nodes": [
        {
          "id": "event-click",
          "kind": "event",
          "type": "on-clic-event",
          "label": "Click",
          "properties": {}
        },
        {
          "id": "navigate-home",
          "kind": "trigger",
          "type": "Navigation",
          "label": "Navigation",
          "properties": {}
        }
      ],
      "edges": [
        {
          "id": "event-to-navigation",
          "source": "event-click",
          "target": "navigate-home"
        }
      ],
      "selectedNodeId": "navigate-home"
    }
  }
}
```

Each screen file contains every binding for that screen. A binding key is `encodeURIComponent(screenId):encodeURIComponent(componentId):encodeURIComponent(eventType)`. The technical event identifier is preserved exactly (for example, `on-clic-event`), as are trigger identifiers such as `ApiService`, `Navigation`, `Conditional`, and `StringEngine`. Friendly labels are presentation-only. Edges are not constrained to a DAG, so cycles remain representable.

### ResourceManifest — `resources/manifest.airres`

```json
{
  "documentVersion": 1,
  "projectId": "a4d0d1d7-75b2-42ad-91c7-86f985a5447b",
  "resources": [
    {
      "id": "resource-logo",
      "name": "logo.png",
      "mimeType": "image/png",
      "byteLength": 18420,
      "sha256": "8f93abc00000000000000000000000000000000000000000000000000000000",
      "storageKey": "8f93abc00000000000000000000000000000000000000000000000000000000",
      "createdAt": "2026-09-19T15:02:00.000Z",
      "tags": ["logo"]
    }
  ]
}
```

The manifest never contains resource bytes or absolute paths. Equal original bytes within one project resolve to the same SHA-256 storage key and one physical blob.

### ProjectSettingsDocument — `settings/project.airsettings`

```json
{
  "documentVersion": 1,
  "projectId": "a4d0d1d7-75b2-42ad-91c7-86f985a5447b",
  "activeScreenId": "screen-home",
  "activeWorkspace": "components",
  "selectedDevice": "iphone-15",
  "zoom": 100
}
```

Only durable project preferences are stored. Hover, open tooltip/modal, loading state, and other ephemeral UI state are excluded.

## Editor-to-document mapping

| Editor state | Persisted document |
|---|---|
| Screen names, descriptions, order, initial screen | `screens/*.airscreen` |
| Layout tree, rows, columns, components and properties | `layouts/*.airlayout` |
| Graphs keyed by screen/component/event | `triggers/*.airgraph` |
| Resource metadata | `resources/manifest.airres` |
| Original resource bytes | `resources/*.airblob` |
| Active screen/workspace/device/zoom | `settings/project.airsettings` |
| Project name/status/card presentation | `metadata/project.airmeta` |

## Create and load lifecycle

Creation writes the root manifest, metadata, initial Home screen/layout, empty resource manifest, and project settings. The schema version is copied from the active `SchemaProvider`; cloud APIs are not called.

Loading performs:

1. Validate owner and project identifiers.
2. Resolve the owner hash and project directory in Electron main.
3. Load or unprotect the installation master key.
4. Derive the owner and project keys.
5. Authenticate/decrypt the root manifest and verify owner, project ID, and format version.
6. Decrypt/decode metadata, screens, layouts, graphs, resources, and settings.
7. Return typed domain data through restricted IPC.
8. Hydrate Editor and Trigger Graph stores before enabling autosave.

A local project selected in Dashboard is identified in UI by the compound identity `LOCAL + projectId`; a cloud project with the same ID remains distinct.

Project listing deliberately does not run the full load lifecycle. It authenticates/decrypts only `.aircraft` and `metadata/project.airmeta`, then counts `*.airscreen` filenames. Layouts, trigger graphs, resources, and settings are opened only when the user opens a project.

## Internal project provisioning

`InternalProjectProvisioner` materializes a typed `InternalProjectSeed` through the same `LocalProjectRepository` and `ResourceRepository` contracts used by the product. The seed can define project metadata, screens with layouts and graph bindings, durable settings, and raw `Uint8Array` resources. Repository composition decides whether the target is the in-memory test implementation or the real Electron pipeline.

The provisioner never accepts encryption keys, filesystem paths, YAML, or legacy project input. With Electron repositories, Main still owns MessagePack serialization, key derivation, AES-GCM encryption, resource hashing, atomic writes, and directory selection. If provisioning fails, the newly created project is removed on a best-effort basis while the original error is preserved. This API is intended for controlled internal generation and test fixtures; it is not an import feature and has no product UI.

## Save lifecycle

`AutosaveCoordinator` uses a 750 ms default debounce and serializes/coalesces writes by document key. Current keys include `screen:<screenId>`, `layout:<screenId>`, `graphs:<screenId>`, and `settings`.

A successful write updates manifest and metadata `updatedAt`. A failed write remains pending, produces `ERROR`, and can be retried by the Save action. Manual Save and logout call `flush()`. Logout does not clear the session when flush fails.

Atomic replacement is:

```text
encode/encrypt → <target>.tmp-<uuid> → file sync → rename
```

On Windows rename-over-existing errors, the previous target moves to a temporary backup; Aircraft restores it if replacement fails.

## Resource lifecycle and preview

1. Renderer reads a selected `File` through `arrayBuffer()` and sends a `Uint8Array` through the typed preload API.
2. Main hashes original bytes with SHA-256.
3. Existing content returns its existing reference; new content writes one encrypted `<sha256>.airblob` and updates `manifest.airres`.
4. Preview reads and decrypts bytes through domain IPC.
5. Renderer creates `Blob` and `URL.createObjectURL()` for supported images.
6. Cleanup calls `URL.revokeObjectURL()`.

No Base64, physical paths, or `file://` URLs are stored in project documents.

## Boundaries

```text
Renderer UI
  → LocalProjectRepository / ResourceRepository
  → Electron repository adapter
  → window.aircraftDesktop typed preload bridge
  → explicit IPC channels
  → LocalProjectFileStore
  → MessagePack / Aircraft envelope / AtomicFileStore
  → operating-system filesystem
```

Web mode uses in-memory repositories for development and tests. It does not claim persistence across browser/process restarts. Desktop mode uses the physical encrypted repository.

## Error behavior

- Unknown/future envelope project format: reject with `UnsupportedProjectVersionError`.
- Unknown/future structured payload version: reject with `UnsupportedDocumentVersionError`.
- Modified ciphertext/header/tag: reject with `ProjectDecryptionError`.
- Missing project/resource: reject; do not return partial data.
- Invalid or traversal-style identifier: reject before path construction.
- Unavailable OS key protection: reject with `LocalStorageUnavailableError` and write no plaintext project.
- A corrupt project is isolated; Electron stays running and the UI reports that the local project could not be opened.

## Evolution

`projectFormatVersion` and each `documentVersion` are explicit migration points. Version 1 rejects unsupported future versions; no migrations exist yet. Optional `extensions` fields are reserved for forward-compatible metadata while fundamental fields remain typed.

Out of scope for this format phase: YAML import, legacy project conversion, cloud synchronization, AWS/S3, Aircraft Engine/JVM, Assembler, Conformance, ADB/USB, and global cross-user resource deduplication.

## Verification checklist

- [ ] Project directories are isolated by owner hash and project UUID.
- [ ] Structured files do not expose known project strings in plaintext.
- [ ] Tampering causes authenticated decryption failure.
- [ ] Resource bytes round-trip exactly and equal bytes produce one blob.
- [ ] Reload restores screens, layouts, graphs, resources, and settings.
- [ ] A failed local flush blocks logout.
- [ ] Web mode remains in-memory and does not import Node/Electron APIs.
