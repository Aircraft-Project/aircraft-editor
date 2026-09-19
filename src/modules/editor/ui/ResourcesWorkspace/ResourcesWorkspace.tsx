"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import type {
  EditorResource,
  EditorResourceKind,
} from "../../domain";
import styles from "./ResourcesWorkspace.module.css";

const resources: readonly EditorResource[] = [
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
  {
    id: "aircraft-logo",
    name: "logo-principal.svg",
    kind: "logo",
    description: "Logotipo principal de la aplicación.",
    size: "18 KB",
    usedIn: ["Home", "Login", "Registro"],
    previewTone: "light",
    tags: ["logo", "marca"],
  },
  {
    id: "color-palette",
    name: "paleta-colores.json",
    kind: "palette",
    description: "Colores compartidos por el proyecto.",
    size: "8 KB",
    usedIn: ["Toda la aplicación"],
    previewTone: "light",
    tags: ["colores", "estilos"],
  },
  {
    id: "terms",
    name: "terminos.pdf",
    kind: "file",
    description: "Términos y condiciones del proyecto.",
    size: "450 KB",
    usedIn: ["Registro"],
    previewTone: "document",
    tags: ["legal", "documento"],
  },
  {
    id: "clouds",
    name: "fondo-nubes.jpg",
    kind: "image",
    description: "Fondo atmosférico reutilizable.",
    size: "2.1 MB",
    usedIn: ["Home", "Detalle", "Perfil"],
    previewTone: "sky",
    tags: ["fondo", "nubes"],
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

export function ResourcesWorkspace() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | EditorResourceKind>("all");
  const [selectedId, setSelectedId] = useState(resources[0].id);
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return resources.filter((resource) => {
      const matchesFilter = filter === "all" || resource.kind === filter;
      const matchesQuery =
        !normalized ||
        resource.name.toLocaleLowerCase().includes(normalized) ||
        resource.tags.some((tag) =>
          tag.toLocaleLowerCase().includes(normalized),
        );
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);
  const selected =
    resources.find((resource) => resource.id === selectedId) ?? resources[0];

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
                selected.id === resource.id ? styles.selected : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedId(resource.id)}
            >
              <ResourcePreview resource={resource} />
              <span className={styles.resourceCopy}>
                <strong>{resource.name}</strong>
                <small>{kindLabel(resource.kind)} · {resource.size}</small>
                <small><Layers3 size={13} /> Usado en {resource.usedIn.length} {resource.usedIn.length === 1 ? "pantalla" : "lugares"}</small>
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
        <ResourcePreview resource={selected} large />
        <h3>{selected.name}</h3>
        <p>{kindLabel(selected.kind)} · {selected.size}</p>
        <section>
          <h4>Descripción</h4>
          <p>{selected.description}</p>
        </section>
        <section>
          <h4>Etiquetas</h4>
          <div className={styles.tags}>
            {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        </section>
        <section>
          <h4>Usado en</h4>
          <ul>
            {selected.usedIn.map((usage) => <li key={usage}>{usage}</li>)}
          </ul>
        </section>
        <p className={styles.localNotice}>
          Los recursos son datos locales controlados. No se realizan uploads
          remotos en esta fase.
        </p>
      </aside>
    </div>
  );
}

function ResourcePreview({
  resource,
  large = false,
}: {
  readonly resource: EditorResource;
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
      <Icon size={large ? 52 : 36} />
    </span>
  );
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
