"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  File,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  List,
  Palette,
  Search,
  Shapes,
  UploadCloud,
} from "lucide-react";
import type {
  ResourceMetadata,
  ResourceRepository,
} from "@/modules/local-project";
import type {
  EditorResource,
  EditorResourceKind,
} from "../../domain";
import styles from "./ResourcesWorkspace.module.css";

const demoResources: readonly EditorResource[] = [
  {
    id: "banner-home",
    name: "banner-inicio.jpg",
    kind: "image",
    description: "Imagen principal de la pantalla de bienvenida.",
    size: "1.2 MB",
    usedIn: ["Home"],
    previewTone: "sky",
    tags: ["banner", "inicio", "avión"],
  },
  {
    id: "aircraft-icon",
    name: "avion-icono.svg",
    kind: "icon",
    description: "Isotipo reutilizable de Aircraft.",
    size: "24 KB",
    usedIn: ["Home", "Login", "Registro", "Perfil"],
    previewTone: "cyan",
    tags: ["aircraft", "icono"],
  },
];

const filters: ReadonlyArray<{
  readonly value: "all" | EditorResourceKind;
  readonly label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "image", label: "Imágenes" },
  { value: "icon", label: "Iconos" },
  { value: "logo", label: "Logos" },
  { value: "palette", label: "Colores y estilos" },
  { value: "file", label: "Archivos" },
];

interface ResourcesWorkspaceProps {
  readonly ownerId?: string;
  readonly projectId?: string;
  readonly repository?: ResourceRepository;
}

export function ResourcesWorkspace({
  ownerId,
  projectId,
  repository,
}: ResourcesWorkspaceProps) {
  const isLocal = Boolean(ownerId && projectId && repository);
  const [resources, setResources] = useState<readonly EditorResource[]>(
    isLocal ? [] : demoResources,
  );
  const [metadataById, setMetadataById] = useState<
    Readonly<Record<string, ResourceMetadata>>
  >({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] =
    useState<"all" | EditorResourceKind>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    resources[0]?.id ?? null,
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<{
    readonly resourceId: string;
    readonly url: string;
  } | null>(null);
  const [resourceError, setResourceError] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ownerId || !projectId || !repository) return;
    let current = true;
    repository
      .list(ownerId, projectId)
      .then((items) => {
        if (!current) return;
        const mapped = items.map(toEditorResource);
        setResources(mapped);
        setMetadataById(
          Object.fromEntries(items.map((item) => [item.id, item])),
        );
        setSelectedId((selected) => selected ?? mapped[0]?.id ?? null);
      })
      .catch(() => {
        if (current) {
          setResourceError("No fue posible cargar los recursos locales.");
        }
      });
    return () => {
      current = false;
    };
  }, [ownerId, projectId, repository]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return resources.filter((resource) => {
      const matchesFilter =
        filter === "all" || resource.kind === filter;
      const matchesQuery =
        !normalized ||
        resource.name.toLocaleLowerCase().includes(normalized) ||
        resource.tags.some((tag) =>
          tag.toLocaleLowerCase().includes(normalized),
        );
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, resources]);

  const selected =
    resources.find((resource) => resource.id === selectedId) ??
    resources[0];

  useEffect(() => {
    if (
      !selected ||
      selected.kind !== "image" ||
      !ownerId ||
      !projectId ||
      !repository
    ) {
      return;
    }
    let current = true;
    let objectUrl: string | null = null;
    repository
      .read(ownerId, projectId, selected.id)
      .then((bytes) => {
        if (!current) return;
        const metadata = metadataById[selected.id];
        objectUrl = URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type: metadata?.mimeType ?? "application/octet-stream",
          }),
        );
        setPreview({ resourceId: selected.id, url: objectUrl });
      })
      .catch(() => {
        if (current) setPreview(null);
      });
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    metadataById,
    ownerId,
    projectId,
    repository,
    selected,
  ]);

  const previewUrl =
    preview?.resourceId === selected?.id ? preview.url : null;

  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !ownerId || !projectId || !repository) return;
    setResourceError(null);
    try {
      await repository.put({
        ownerId,
        projectId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      const items = await repository.list(ownerId, projectId);
      const mapped = items.map(toEditorResource);
      setResources(mapped);
      setMetadataById(
        Object.fromEntries(items.map((item) => [item.id, item])),
      );
      setSelectedId(mapped.find((item) => item.name === file.name)?.id ?? null);
    } catch {
      setResourceError("No fue posible guardar el recurso local.");
    }
  };

  return (
    <div className={styles.workspace}>
      <main className={styles.library}>
        <header className={styles.heading}>
          <span><FolderOpen size={25} /></span>
          <div>
            <h2>Módulo Recursos</h2>
            <p>Gestiona archivos y recursos reutilizables del proyecto.</p>
          </div>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={18} />
            <span className="sr-only">Buscar recursos</span>
            <input
              type="search"
              placeholder="Buscar recursos..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {isLocal ? (
            <>
              <input
                ref={fileInputRef}
                className={styles.hiddenInput}
                type="file"
                onChange={(event) => void upload(event)}
              />
              <button
                type="button"
                className={styles.uploadButton}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={18} /> Subir recurso
              </button>
            </>
          ) : null}
          <div className={styles.viewSwitch} aria-label="Vista de recursos">
            <button
              type="button"
              aria-label="Vista de cuadrícula"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={18} />
            </button>
            <button
              type="button"
              aria-label="Vista de lista"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {resourceError ? <p role="alert">{resourceError}</p> : null}

        <div className={styles.filters} aria-label="Filtrar recursos">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          className={[
            styles.resourceGrid,
            view === "list" ? styles.listView : "",
          ].filter(Boolean).join(" ")}
        >
          {filtered.map((resource) => (
            <button
              key={resource.id}
              type="button"
              className={[
                styles.resourceCard,
                selected?.id === resource.id ? styles.selected : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedId(resource.id)}
            >
              <ResourcePreview
                resource={resource}
                previewUrl={
                  selected?.id === resource.id ? previewUrl : null
                }
              />
              <span className={styles.resourceCopy}>
                <strong>{resource.name}</strong>
                <small>
                  {kindLabel(resource.kind)} · {resource.size}
                </small>
                <small>
                  <Layers3 size={13} /> Usado en {resource.usedIn.length}{" "}
                  {resource.usedIn.length === 1 ? "pantalla" : "lugares"}
                </small>
              </span>
            </button>
          ))}
        </div>
      </main>

      <aside className={styles.inspector}>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected="true">
            Información
          </button>
          <button type="button" role="tab" aria-selected="false" disabled>
            Usos
          </button>
        </div>
        {selected ? (
          <>
            <ResourcePreview
              resource={selected}
              previewUrl={previewUrl}
              large
            />
            <h3>{selected.name}</h3>
            <p>{kindLabel(selected.kind)} · {selected.size}</p>
            <section>
              <h4>Descripción</h4>
              <p>{selected.description}</p>
            </section>
            <section>
              <h4>Etiquetas</h4>
              <div className={styles.tags}>
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p>No hay recursos en este proyecto.</p>
        )}
        <p className={styles.localNotice}>
          Los recursos locales están cifrados y no se realizan uploads
          remotos en esta fase.
        </p>
      </aside>
    </div>
  );
}

function ResourcePreview({
  resource,
  previewUrl,
  large = false,
}: {
  readonly resource: EditorResource;
  readonly previewUrl?: string | null;
  readonly large?: boolean;
}) {
  const Icon =
    resource.kind === "image"
      ? ImageIcon
      : resource.kind === "palette"
        ? Palette
        : resource.kind === "icon" || resource.kind === "logo"
          ? Shapes
          : File;
  return (
    <span
      className={[
        styles.resourcePreview,
        styles[resource.previewTone],
        large ? styles.largePreview : "",
      ].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {previewUrl ? (
        <Image
          className={styles.previewImage}
          src={previewUrl}
          alt=""
          width={large ? 360 : 260}
          height={large ? 220 : 150}
          unoptimized
        />
      ) : (
        <Icon size={large ? 52 : 36} />
      )}
    </span>
  );
}

function toEditorResource(
  metadata: ResourceMetadata,
): EditorResource {
  const kind = kindFromMime(metadata.mimeType);
  return {
    id: metadata.id,
    name: metadata.name,
    kind,
    description: "Recurso local del proyecto.",
    size: formatBytes(metadata.byteLength),
    usedIn: [],
    previewTone: kind === "image" ? "sky" : "document",
    tags: metadata.tags,
  };
}

function kindFromMime(mimeType: string): EditorResourceKind {
  if (mimeType.startsWith("image/")) return "image";
  return "file";
}

function formatBytes(byteLength: number): string {
  if (byteLength < 1024) return byteLength + " B";
  if (byteLength < 1024 * 1024) {
    return (byteLength / 1024).toFixed(1) + " KB";
  }
  return (byteLength / (1024 * 1024)).toFixed(1) + " MB";
}

function kindLabel(kind: EditorResourceKind): string {
  return {
    image: "Imagen",
    icon: "Icono",
    logo: "Logo",
    palette: "Colores y estilos",
    file: "Archivo",
  }[kind];
}
