"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Home,
  MonitorSmartphone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type {
  ContextRules,
  SchemaProvider,
} from "@/modules/aircraft-schema";
import { DevicePreview } from "../DevicePreview";
import {
  type ScreenContext,
  useEditorStore,
} from "@/store/useEditorStore";
import styles from "./ScreensWorkspace.module.css";

interface ScreensWorkspaceProps {
  readonly provider: SchemaProvider;
  readonly devicePresetId: string;
}

export function ScreensWorkspace({
  provider,
  devicePresetId,
}: ScreensWorkspaceProps) {
  const {
    screens,
    screenTrees,
    activeScreenId,
    initialScreenId,
    setActiveScreen,
    createScreen,
    updateScreen,
    duplicateScreen,
    removeScreen,
    setInitialScreen,
  } = useEditorStore();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [contexts, setContexts] = useState<readonly ContextRules[]>([]);
  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let current = true;
    provider
      .listContexts()
      .then((items) => {
        if (!current) return;
        if (!items.length) {
          setContexts([]);
          setContextStatus("error");
          return;
        }
        setContexts(items);
        setContextStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setContexts([]);
        setContextStatus("error");
      });
    return () => {
      current = false;
    };
  }, [provider]);

  const activeScreen =
    screens.find((screen) => screen.id === activeScreenId) ?? screens[0];
  const body = screenTrees[activeScreen.id];
  const filteredScreens = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return screens;
    return screens.filter(
      (screen) =>
        screen.name.toLocaleLowerCase().includes(normalized) ||
        screen.description.toLocaleLowerCase().includes(normalized),
    );
  }, [query, screens]);

  return (
    <div className={styles.workspace}>
      <aside className={styles.screenList}>
        <div className={styles.heading}>
          <span><MonitorSmartphone size={22} /></span>
          <div>
            <h2>Módulo Pantallas</h2>
            <p>Organiza la navegación de tu aplicación.</p>
          </div>
        </div>

        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar pantallas</span>
          <input
            type="search"
            placeholder="Buscar pantallas..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setCreating(true)}
        >
          <Plus size={18} /> Nueva pantalla
        </button>

        <div className={styles.screens}>
          {filteredScreens.map((screen) => (
            <button
              key={screen.id}
              type="button"
              className={[
                styles.screenCard,
                screen.id === activeScreenId ? styles.active : "",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                setCreating(false);
                setActiveScreen(screen.id);
              }}
            >
              <span className={styles.thumbnail}>
                <MonitorSmartphone size={20} />
              </span>
              <span>
                <strong>
                  {screen.id === initialScreenId ? (
                    <Home size={13} aria-label="Pantalla inicial" />
                  ) : null}
                  {screen.name}
                </strong>
                <small>{screen.description || "Sin descripción"}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.preview}>
        <DevicePreview
          body={body}
          devicePresetId={devicePresetId}
          screenName={activeScreen.name}
        />
      </main>

      <aside className={styles.inspector}>
        {creating ? (
          <CreateScreenForm
            contexts={contexts}
            contextStatus={contextStatus}
            onCancel={() => setCreating(false)}
            onCreate={(name, description, context) => {
              createScreen(name, description, context);
              setCreating(false);
            }}
          />
        ) : (
          <>
            <div className={styles.inspectorTitle}>
              <strong>Propiedades de pantalla</strong>
              <span>{activeScreen.name}</span>
            </div>
            <section className={styles.section}>
              <label>
                <span>Nombre</span>
                <input
                  value={activeScreen.name}
                  onChange={(event) =>
                    updateScreen(activeScreen.id, {
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Descripción opcional</span>
                <textarea
                  value={activeScreen.description}
                  onChange={(event) =>
                    updateScreen(activeScreen.id, {
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Tipo de pantalla</span>
                <select
                  value={activeScreen.context}
                  onChange={(event) =>
                    updateScreen(activeScreen.id, {
                      context: event.target.value,
                    })
                  }
                  disabled={contextStatus !== "ready"}
                >
                  {contexts.map(({ context }) => (
                    <option key={context} value={context}>
                      {context === "interface"
                        ? "Pantalla"
                        : "Elemento de catálogo"}
                    </option>
                  ))}
                </select>
              </label>
              {contextStatus === "error" ? (
                <p role="alert">
                  No fue posible cargar los contextos del schema.
                </p>
              ) : null}
            </section>
            <section className={styles.actions}>
              <button
                type="button"
                onClick={() => setInitialScreen(activeScreen.id)}
                disabled={activeScreen.id === initialScreenId}
              >
                <Home size={16} /> Establecer como inicial
              </button>
              <button
                type="button"
                onClick={() => duplicateScreen(activeScreen.id)}
              >
                <Copy size={16} /> Duplicar
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => removeScreen(activeScreen.id)}
                disabled={screens.length <= 1}
              >
                <Trash2 size={16} /> Eliminar pantalla
              </button>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

interface CreateScreenFormProps {
  readonly contexts: readonly ContextRules[];
  readonly contextStatus: "loading" | "ready" | "error";
  readonly onCancel: () => void;
  readonly onCreate: (
    name: string,
    description: string,
    context: ScreenContext,
  ) => void;
}

function CreateScreenForm({
  contexts,
  contextStatus,
  onCancel,
  onCreate,
}: CreateScreenFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState<ScreenContext>(
    contexts[0]?.context ?? "",
  );

  const effectiveContext = contexts.some(
    ({ context: contextName }) => contextName === context,
  )
    ? context
    : (contexts[0]?.context ?? "");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized || !effectiveContext || contextStatus !== "ready") return;
    onCreate(normalized, description.trim(), effectiveContext);
  };

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <div className={styles.inspectorTitle}>
        <strong>Crear nueva pantalla</strong>
        <span>Define la información visible para tu equipo.</span>
      </div>
      <label>
        <span>Nombre</span>
        <input
          autoFocus
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        <span>Descripción opcional</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        <span>Tipo de pantalla</span>
        <select
          value={effectiveContext}
          onChange={(event) =>
            setContext(event.target.value)
          }
          disabled={contextStatus !== "ready"}
        >
          {contexts.map(({ context: contextName }) => (
            <option key={contextName} value={contextName}>
              {contextName === "interface"
                ? "Pantalla"
                : "Elemento de catálogo"}
            </option>
          ))}
        </select>
      </label>
      {contextStatus === "error" ? (
        <p role="alert">No fue posible cargar los contextos.</p>
      ) : null}
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={contextStatus !== "ready" || !effectiveContext}
        >
          Crear pantalla
        </button>
      </div>
    </form>
  );
}
