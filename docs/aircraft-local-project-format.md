# Aircraft local project format v1

Aircraft Editor stores each desktop project as an independent, encrypted directory under Electron `userData`. Structured documents use MessagePack; resources keep their original bytes. The renderer never receives physical paths and never calls Node filesystem APIs.

## Quick path

1. Electron resolves `<userData>/local-projects`.
2. A stable session `user.id` selects `users/<sha256(ownerId)>`.
3. Each project is loaded from `projects/<projectId>` and decrypted with its own derived key.
4. Editor stores hydrate from granular documents; autosave writes only affected documents.
5. Resource bytes are addressed by SHA-256 and remain outside the resource manifest.

## Aircraft Editor workspace

Electron Main resolves one installation-independent workspace from `app.getPath("home")` and initializes it before opening the application window:

```text
<home>/AircraftEditor/
├── config/
│   └── workspace.json
├── security/
├── local-projects/
├── logs/
├── cache/
└── temp/
```

`config/workspace.json` is intentionally minimal and portable:

```json
{
  "workspaceVersion": 1,
  "localProjectsDirectory": "local-projects"
}
```

The resolver never hardcodes a username or stores the absolute home path in the configuration. Bootstrap is idempotent: it creates missing directories and the configuration once, but it never overwrites an existing valid file. Invalid JSON, an unsupported `workspaceVersion`, or a different `localProjectsDirectory` fails startup with a controlled error so existing data is not silently replaced.

Phase 1.5.4B activates `<home>/AircraftEditor/security/.master-key` as the installation master-key location. The active encrypted project store remains `<userData>/local-projects` until Phase 1.5.4C. If a legacy `<userData>/local-projects/.master-key` exists, startup validates and copies its protected bytes atomically to the workspace without rotation or project re-encryption; the legacy file remains as a temporary backup. Do not delete legacy storage manually before Phase 1.5.4C. No workspace path or migration status is exposed to the renderer or through IPC.

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
<home>/AircraftEditor/
└── security/
    └── .master-key          # active installation master key

<userData>/
└── local-projects/
    ├── .master-key          # temporary legacy backup when present
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
                    ├── catalog-items/
                    │   └── <catalogItemId>.aircatalog
                    ├── resources/
                    │   ├── manifest.airres
                    │   └── <sha256>.airblob
                    └── settings/
                        ├── project.airsettings
                        └── theme.airtheme
```

Every `projectId`, `screenId`, `catalogItemId`, and resource ID used to construct a path must match `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`. Renderer input can never select a physical path.

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
| `*.aircatalog` | 9 | `CatalogItemDocument` |
| `theme.airtheme` | 10 | `ThemeDocument` |

Extensions aid recognition; they do not provide security. Every file has an authenticated Aircraft envelope.

## Binary envelope

All persisted files use this layout:

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 8 | ASCII magic `AIRCRFT1` |
| 8 | 1 | Envelope version (`1`) |
| 9 | 1 | Document type (`1..10`) |
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
  └─ safeStorage.encryptString(base64(masterKey)) → <home>/AircraftEditor/security/.master-key
      └─ HKDF-SHA256(salt = UTF-8 ownerId, info = "aircraft:user:v1")
          └─ 32-byte owner key
              └─ HKDF-SHA256(salt = UTF-8 projectId, info = "aircraft:project:v1")
                  └─ 32-byte project key → AES-256-GCM
```

`ownerId` and `projectId` provide HKDF separation but are not secrets and are never used directly as AES keys. Keys and decrypted project payloads must not be logged.

The master key belongs to the Aircraft workspace, not to an individual project or to the local-projects directory. Migration compares decrypted 32-byte keys with `timingSafeEqual`; conflicting valid keys fail closed and neither file is overwritten. The cryptographic algorithms, HKDF salts/info, and existing project ciphertext remain unchanged.

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
  "destination": "home",
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
  "screenId": "1a2b3c4d5e6f7081",
  "tree": {
    "id": "2a2b3c4d5e6f7081",
    "kind": "body",
    "properties": {
      "cardPadding": 16,
      "cardBackgroundColor": "FFFFFF"
    },
    "columns": [
      {
        "id": "3a2b3c4d5e6f7081",
        "kind": "column",
        "properties": {
          "padding": 8,
          "scrollable": false
        },
        "rows": [
          {
            "id": "4a2b3c4d5e6f7081",
            "kind": "row",
            "content": "component",
            "height": 240,
            "properties": {
              "horizontalArrangement": "Center"
            },
            "component": {
              "id": "5a2b3c4d5e6f7081",
              "kind": "component",
              "type": "Button",
              "subtype": "Primary",
              "name": "Continue",
              "properties": { "text": "Continue" },
              "observers": [
                { "observerIdentifier": "profile-observer" }
              ],
              "mcpMetadata": { "source": "authoring" }
            }
          }
        ]
      }
    ]
  }
}
```

The `tree` is the Editor `BodyNode`. Known structural semantics are typed: Body preserves `cardPadding`, `cardBackgroundColor`, `viewType`, and `identifier`; Column preserves only the Assembler properties `padding` and `scrollable`; Row preserves `padding`, `horizontalArrangement`, and `verticalAlignment`. Unknown schema-compatible properties and explicit `extensions` remain lossless through hydration and unrelated autosaves.

H-3 is encoded as a discriminated union. A row is `empty`, contains exactly one `component`, or contains one-or-more `columns`. It can never semantically contain both, and it cannot contain two components. Valid legacy `children` arrays normalize to this union. Ambiguous legacy rows fail with `AircraftProjectSemanticError` rather than dropping content.

Row sizing follows H-11: `height` and `weight` are mutually exclusive. `wrap_content`, `match_parent`, numeric dp heights, and numeric row weight map deterministically to Assembler `HeightValue`. Vertical Catalog rows additionally follow H-10: they have weight and no height. H-9 rejects a vertical Catalog below a scrollable Column.

`Column.weight` is not an Assembler property and is not part of the semantic layout. A legacy value is retained only as `ColumnNode.editorMetadata.legacyWeight`; it does not affect the runtime-faithful preview and is never presented as Assembler semantics. Column siblings therefore use the runtime's equal-share behavior. No format-version bump is needed because the encrypted envelope and document version are unchanged.

Component technical types, subtypes, properties, `observers`, string-to-string `mcpMetadata`, and explicit node `extensions` remain exact. New semantic identifiers use 16 lowercase hexadecimal characters and are checked against current screen, layout, catalog, and trigger identifiers before insertion.

### TriggerGraphDocument — `triggers/<screenId>.airgraph`

```json
{
  "documentVersion": 1,
  "screenId": "1a2b3c4d5e6f7081",
  "graphs": {
    "1a2b3c4d5e6f7081:5a2b3c4d5e6f7081:on-clic-event": {
      "rootVertexId": "6a2b3c4d5e6f7081",
      "nodes": [
        {
          "id": "6a2b3c4d5e6f7081",
          "kind": "trigger",
          "type": "Navigation",
          "label": "Navigation",
          "properties": {
            "type": "Navigate",
            "target": "1a2b3c4d5e6f7081"
          },
          "mcpMetadata": { "source": "authoring" }
        }
      ],
      "edges": [],
      "selectedNodeId": "6a2b3c4d5e6f7081",
      "mcpMetadata": { "graph": "main" }
    }
  }
}
```

Each screen file contains every binding for that screen. A binding key is `encodeURIComponent(screenId):encodeURIComponent(componentId):encodeURIComponent(eventType)`. Persisted nodes are TriggerVertices only. ReactFlow derives a visual Event node and exactly one visual Event-to-root edge; neither is serialized as a TriggerVertex or semantic adjacency edge.

A non-empty graph has exactly one `rootVertexId`, that vertex exists, every successor exists, and every vertex is reachable from the root. Cycles, including self-cycles, remain valid and are not converted into a DAG. Legacy graphs with exactly one Event output derive the root; multiple Event outputs fail with a controlled semantic error. `selectedNodeId` remains Editor metadata. Trigger identifiers, persistence flags, string-to-string `mcpMetadata`, and explicit graph/document `extensions` survive unrelated autosaves.

### CatalogItemDocument — `catalog-items/<catalogItemId>.aircatalog`

```json
{
  "documentVersion": 1,
  "catalogItemId": "movie-card",
  "name": "movie-card",
  "destination": "movie-card",
  "context": "catalog-item",
  "layout": {
    "id": "catalog-body",
    "kind": "body",
    "properties": {},
    "columns": []
  }
}
```

A catalog item is edited separately from the Screens workspace and maps to an Assembler `InterfaceDocument` with `DocumentContext.CATALOG_ITEM`. The local format retains `destination` for backward compatibility and may default it deterministically to `catalogItemId`, but it is not part of the interface M-5 namespace. Aircraft YAML identifies a catalog item through its identifier/name and emits only its body at the document root; a future Engine/YamlSerializer must not emit the local `destination` as a root `CATALOG_ITEM` property. Catalog context rules come from `SchemaProvider.getContextRules("catalog-item")`; when `supportsTriggers` is false, the Editor disables Trigger workspace access for that item.

### ThemeDocument — `settings/theme.airtheme`

```json
{
  "documentVersion": 1,
  "projectId": "a4d0d1d7-75b2-42ad-91c7-86f985a5447b",
  "theme": {
    "colors": {
      "primary": "00CFFF",
      "onPrimary": "FFFFFF"
    },
    "typography": {
      "titleLarge": {
        "fontSize": 22,
        "fontWeight": 700,
        "lineHeight": 28,
        "letterSpacing": 0
      }
    },
    "spacing": {
      "medium": 16
    },
    "shapes": {
      "medium": 12
    }
  },
  "componentTheme": {
    "textField": {
      "focusedBorderColor": "$colors.primary",
      "shape": "$shapes.medium"
    },
    "textLabel": {
      "textColorDefault": "$colors.onPrimary",
      "textStyle": "$typography.titleLarge",
      "paddingHorizontal": 16,
      "paddingVertical": null
    }
  }
}
```

Known theme sections (`colors`, `typography`, `spacing`, and `shapes`) and current TextField/TextLabel component-theme fields are typed. Their token keys remain data-driven records, and explicit `extensions` containers preserve future metadata without replacing known fields with an untyped blob. Theme currently has no full editing UI; changes to unrelated documents must not rewrite or discard it.

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
| Screen names, descriptions, destination, order, initial screen | `screens/*.airscreen` |
| Layout tree, rows, columns, components and properties | `layouts/*.airlayout` |
| Graphs keyed by screen/component/event, including trigger persistence | `triggers/*.airgraph` |
| Catalog-item InterfaceDocuments and layouts | `catalog-items/*.aircatalog` |
| Aircraft theme and component themes | `settings/theme.airtheme` |
| Resource metadata | `resources/manifest.airres` |
| Original resource bytes | `resources/*.airblob` |
| Active screen/workspace/device/zoom | `settings/project.airsettings` |
| Project name/status/card presentation | `metadata/project.airmeta` |

## Create and load lifecycle

Creation writes the root manifest, metadata, initial Home screen/layout, empty resource manifest, empty typed theme, and project settings; it also creates the catalog-items directory. The schema version is copied from the active `SchemaProvider`; cloud APIs are not called.

Loading performs:

1. Validate owner and project identifiers.
2. Resolve the owner hash and project directory in Electron main.
3. Load or unprotect the installation master key.
4. Derive the owner and project keys.
5. Authenticate/decrypt the root manifest and verify owner, project ID, and format version.
6. Decrypt/decode metadata, screens, layouts, graphs, catalog items, theme, resources, and settings.
7. Return typed domain data through restricted IPC.
8. Hydrate Editor and Trigger Graph stores before enabling autosave.

A local project selected in Dashboard is identified in UI by the compound identity `LOCAL + projectId`; a cloud project with the same ID remains distinct.

Project listing deliberately does not run the full load lifecycle. It authenticates/decrypts only `.aircraft` and `metadata/project.airmeta`, then counts `*.airscreen` filenames. Layouts, trigger graphs, resources, and settings are opened only when the user opens a project.

## Internal project provisioning

`InternalProjectProvisioner` materializes a typed `InternalProjectSeed` through the same `LocalProjectRepository` and `ResourceRepository` contracts used by the product. The seed can define project metadata, screens with layouts and graph bindings, catalog items, theme/component theme, durable settings, and raw `Uint8Array` resources. Repository composition decides whether the target is the in-memory test implementation or the real Electron pipeline.

The provisioner never accepts encryption keys, filesystem paths, YAML, or legacy project input. With Electron repositories, Main still owns MessagePack serialization, key derivation, AES-GCM encryption, resource hashing, atomic writes, and directory selection. If provisioning fails, the newly created project is removed on a best-effort basis while the original error is preserved. This API is intended for controlled internal generation and test fixtures; it is not an import feature and has no product UI.

## Save lifecycle

`AutosaveCoordinator` uses a 750 ms default debounce and serializes/coalesces writes by document key. Current keys include `screen:<screenId>`, `layout:<screenId>`, `graphs:<screenId>`, `catalog-item:<catalogItemId>`, and `settings`. Catalog writes and deletes are granular. Theme is preserved by project load/save but is not autosaved until a theme editor owns that state.

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

## Backward compatibility within version 1

The compatibility additions remain `projectFormatVersion = 1` and `documentVersion = 1` because they add optional documents/fields without changing the encrypted envelope or existing payload meaning:

- a missing `catalog-items/` directory loads as an empty catalog;
- a missing `settings/theme.airtheme` loads as an empty typed theme for that project;
- a legacy screen without `destination` hydrates with `screenId` as its deterministic destination;
- missing Body/Column/Row `properties` maps hydrate as `{}`;
- legacy rows containing both height and weight normalize deterministically to weight under H-11;
- legacy `Column.weight` is retained only as non-semantic `editorMetadata.legacyWeight`;
- valid legacy row `children` normalize to the H-3 union, while mixed/multiple-component rows fail explicitly;
- legacy trigger graphs with one Event output derive `rootVertexId`; multiple outputs fail explicitly;
- missing trigger persistence means no explicit runtime flag selection.

Missing optional data is not corruption. Authentication failure, unsupported versions, or malformed required identities still fail with controlled errors. A future incompatible representation must increment the relevant version and use an explicit migration.

## Assembler semantic invariants

Aircraft Editor performs a focused preflight before internal provisioning and exposes the same checks for persisted project documents. It is intentionally not a TypeScript copy of the Assembler: the future Kotlin Engine/Assembler remains the final authority.

- **H-3:** Row is empty, one Component, or one-or-more Columns; ambiguous legacy data is rejected losslessly.
- **H-9:** a scrollable Column cannot contain a vertical Catalog anywhere in its subtree.
- **H-10:** a Row containing a vertical Catalog has weight and no height.
- **H-11:** Row height and weight are mutually exclusive.
- **D-2…D-5:** non-empty trigger graphs have an existing root, valid successors, and complete reachability; cycles remain valid.
- **M-1…M-5 and M-8:** at least one interface exists, exactly one initial interface and its layout exist, interface names/identifiers and destinations are valid, and CatalogItem identifiers are unique.
- **T-4:** Body, Column, Row, Component, and TriggerVertex identifiers share one namespace per InterfaceDocument. Graphs of the same interface share that namespace; different interfaces may reuse internal identifiers. Each CatalogItem has its own Body/Column/Row/Component namespace.
- **M-6 / M-7:** existing Navigation targets and Catalog item views must resolve. Missing `target` or `itemView` belongs to future schema/trigger validation and is not reported as M-6/M-7.
- **CatalogItem identity:** `catalogItemId === name` for `context = "catalog-item"`; normal screens are strictly `context = "interface"`.
- **M-5 / Interface destination:** non-empty, trimmed, one segment, contains neither `/` nor `\`, and is unique only among InterfaceDocuments. `CatalogItemDocument.destination` remains local compatibility data and does not participate in M-5.

`InternalProjectProvisioner` validates all documents supplied by the seed before the first repository write. When screens are omitted it performs partial validation of supplied CatalogItems; an explicit `activeScreenId` without screens is rejected before creation. Full interface-reference validation requires the concrete screen documents. `SchemaProvider` remains the source of component, event, trigger, property, and ContextRules catalogs; only verified cross-schema Assembler invariants are encoded directly.

`mcpMetadata` is `Readonly<Record<string, string>>` on Interface/Body/Column/Row/Component/TriggerGraph/TriggerVertex equivalents. Component observers are persisted as `{ observerIdentifier }` references. Screen, layout, trigger document, settings, manifest, metadata, catalog, theme, resource, graph, and node extension containers remain sidecar/domain data when the UI does not understand them, preventing unrelated edits from erasing future fields.

Known gap: aircraft-android runtime can understand per-side padding properties such as `paddingTop`, `paddingBottom`, `paddingStart`, and `paddingEnd` in places where the current Assembler model is narrower. The Editor preserves those schema-compatible properties losslessly but does not invent a mapping. Aligning that model/runtime gap belongs in a future aircraft-android task.
## Relationship with aircraft-android / Assembler

The encrypted `.air*` directory is the physical persistence format owned by Aircraft Editor. It is not a second Aircraft language. aircraft-android/Assembler remains the semantic reference for interfaces, catalog items, Body/Column/Row structure, components, trigger graphs, persistence flags, theme, schema, and context rules.

The deterministic future Engine mapping is:

| Editor persisted model | Assembler semantic model |
|---|---|
| `ScreenDocument.screenId` | `InterfaceDocument.identifier` |
| `ScreenDocument.destination` | `InterfaceDocument.destination` |
| Screen name + `LayoutDocument.tree` | `InterfaceDocument.name` + `body` |
| `ScreenDocument.context = "interface"` | `DocumentContext.INTERFACE` |
| `CatalogItemDocument.catalogItemId` | `InterfaceDocument.identifier` |
| `CatalogItemDocument.name` + `layout` | `InterfaceDocument.name` + `body` |
| `CatalogItemDocument.destination` | Aircraft Editor local/backward-compatibility metadata; no mapping to `InterfaceDocument.destination` for `CATALOG_ITEM`, and not serialized as a root YAML property |
| `CatalogItemDocument.context = "catalog-item"` | `DocumentContext.CATALOG_ITEM` |
| `ThemeDocument.theme` | Assembler `ThemeConfigData` |
| `ThemeDocument.componentTheme` | Assembler `ComponentThemeConfigData` |

Screen-only Editor metadata such as description, initial-screen marker, and order remains project authoring metadata unless the future Engine has an explicit runtime target for it. `ProjectSettingsDocument` fields such as active workspace, preview device, zoom, and active selection are UI-only and do not belong in Aircraft YAML.

Components, events, triggers, and `ContextRules` continue to come from `SchemaProvider`; no parallel catalog is introduced. Technical type/subtype/event/trigger identifiers are preserved exactly. Known semantic fields are typed, while explicit property/extension maps retain Aircraft data that the current UI cannot edit so unrelated autosaves do not erase it.

A future Aircraft Engine/JVM integration will translate these persisted models to the real Assembler model. YAML generation will be delegated to the Kotlin `YamlSerializer`; Aircraft Editor intentionally contains no TypeScript YAML serializer, importer, or project-specific converter.

## Evolution

`projectFormatVersion` and each `documentVersion` are explicit migration points. Version 1 rejects unsupported future versions; no migrations exist yet. Optional `extensions` fields are reserved for forward-compatible metadata while fundamental fields remain typed.

Out of scope for this format phase: YAML import/export in TypeScript, legacy project conversion, cloud synchronization, AWS/S3, Aircraft Engine/JVM runtime integration, Assembler execution, Conformance execution, ADB/USB, and global cross-user resource deduplication.

## Verification checklist

- [ ] Project directories are isolated by owner hash and project UUID.
- [ ] Structured files do not expose known project strings in plaintext.
- [ ] Tampering causes authenticated decryption failure.
- [ ] Resource bytes round-trip exactly and equal bytes produce one blob.
- [ ] Reload restores destinations, structural layout properties, catalog items, themes, graphs, resources, and settings.
- [ ] Height/weight remains H-11 compliant across hydrate, edit, autosave, and reopen.
- [ ] Catalog context rules disable unsupported trigger editing.
- [ ] Unknown schema-compatible properties and explicit extensions survive unrelated edits.
- [ ] A failed local flush blocks logout.
- [ ] Web mode remains in-memory and does not import Node/Electron APIs.
