/** @jest-environment node */

import { AutosaveCoordinator } from "../application/AutosaveCoordinator";
import {
  createScreenDocuments,
  projectToEditorState,
} from "../application/projectMapper";
import {
  DOCUMENT_VERSION,
  LocalProjectNotFoundError,
  type LayoutDocument,
  type ScreenDocument,
  type TriggerGraphDocument,
} from "../domain";
import {
  InMemoryLocalProjectRepository,
  InMemoryResourceRepository,
} from "./InMemoryLocalProjectRepository";

const ownerA = "usr-admin-001";
const ownerB = "usr-developer-001";

async function createProject(
  repository: InMemoryLocalProjectRepository,
  ownerId: string,
  name: string,
) {
  return repository.create({
    ownerId,
    name,
    description: name + " description",
    schemaVersion: "snapshot-1",
    schemaSourceRevision: "test-revision",
  });
}

describe("InMemory local project repositories", () => {
  it("isolates projects by stable owner id", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const projectA = await createProject(repository, ownerA, "Project A");
    const projectB = await createProject(repository, ownerB, "Project B");

    await expect(repository.listByOwner(ownerA)).resolves.toEqual([
      expect.objectContaining({ id: projectA.manifest.projectId, ownerId: ownerA }),
    ]);
    await expect(repository.listByOwner(ownerB)).resolves.toEqual([
      expect.objectContaining({ id: projectB.manifest.projectId, ownerId: ownerB }),
    ]);
    await expect(
      repository.load(ownerB, projectA.manifest.projectId),
    ).rejects.toBeInstanceOf(LocalProjectNotFoundError);
  });

  it("persists independent trigger bindings, screens, layout and settings", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await createProject(repository, ownerA, "Persistent Project");
    const projectId = project.manifest.projectId;
    const initialScreenId = project.screens[0].screenId;
    const secondScreenId = "screen-profile";
    const secondScreen: ScreenDocument = {
      documentVersion: DOCUMENT_VERSION,
      screenId: secondScreenId,
      name: "Profile",
      description: "User profile",
      destination: secondScreenId,
      context: "interface",
      isInitial: true,
      order: 1,
    };
    const layout: LayoutDocument = {
      documentVersion: DOCUMENT_VERSION,
      screenId: secondScreenId,
      tree: {
        ...project.layouts[initialScreenId].tree,
        id: "body-profile",
      },
    };
    const graphA = secondScreenId + ":button-save:CLICK";
    const graphB = secondScreenId + ":button-save:LONG_PRESS";
    const graphs: TriggerGraphDocument = {
      documentVersion: DOCUMENT_VERSION,
      screenId: secondScreenId,
      graphs: {
        [graphA]: {
          rootVertexId: "event-click",
          nodes: [
            {
              id: "event-click",
              kind: "trigger",
              type: "CLICK",
              label: "Click",
              properties: {},
            },
          ],
          edges: [],
          selectedNodeId: "event-click",
        },
        [graphB]: {
          rootVertexId: "event-long",
          nodes: [
            {
              id: "event-long",
              kind: "trigger",
              type: "LONG_PRESS",
              label: "Long press",
              properties: {},
            },
          ],
          edges: [],
          selectedNodeId: "event-long",
        },
      },
    };

    await repository.saveScreen(ownerA, projectId, secondScreen);
    await repository.saveLayout(ownerA, projectId, layout);
    await repository.saveTriggerGraphs(ownerA, projectId, graphs);
    await repository.saveSettings(ownerA, projectId, {
      ...project.settings,
      activeScreenId: secondScreenId,
      activeWorkspace: "triggers",
      selectedDevice: "iphone-15-pro-max",
      zoom: 125,
    });
    await repository.deleteScreen(ownerA, projectId, initialScreenId);

    const loaded = await repository.load(ownerA, projectId);
    expect(loaded.screens).toEqual([secondScreen]);
    expect(loaded.layouts[secondScreenId]).toEqual(layout);
    expect(loaded.triggerGraphs[secondScreenId].graphs[graphA]).toEqual(
      graphs.graphs[graphA],
    );
    expect(loaded.triggerGraphs[secondScreenId].graphs[graphB]).toEqual(
      graphs.graphs[graphB],
    );
    expect(loaded.settings).toMatchObject({
      activeScreenId: secondScreenId,
      activeWorkspace: "triggers",
      selectedDevice: "iphone-15-pro-max",
      zoom: 125,
    });
  });

  it("preserves destination through save, load, hydrate, save and reload", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await createProject(repository, ownerA, "Destination Project");
    const screen = {
      ...project.screens[0],
      destination: "app://home",
    };
    await repository.saveScreen(ownerA, project.manifest.projectId, screen);

    const loaded = await repository.load(ownerA, project.manifest.projectId);
    const hydrated = projectToEditorState(loaded);
    const documents = createScreenDocuments(
      hydrated.screens,
      hydrated.initialScreenId,
    );
    await repository.saveScreen(
      ownerA,
      project.manifest.projectId,
      documents[0],
    );

    await expect(
      repository.load(ownerA, project.manifest.projectId),
    ).resolves.toMatchObject({
      screens: [expect.objectContaining({ destination: "app://home" })],
    });
  });

  it("persists catalog items, theme and trigger-node persistence", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await createProject(repository, ownerA, "Extended Project");
    const projectId = project.manifest.projectId;
    const catalogItem = {
      documentVersion: DOCUMENT_VERSION,
      catalogItemId: "movie-card",
      name: "Movie card",
      destination: "movie-card",
      context: "catalog-item" as const,
      layout: {
        ...project.layouts[project.screens[0].screenId].tree,
        properties: { role: "card" },
      },
    };
    const theme = {
      documentVersion: DOCUMENT_VERSION,
      projectId,
      theme: { colors: { primary: "00CFFF" } },
      componentTheme: {
        textField: { cursorColor: "$colors.primary" },
      },
    };
    const graph = {
      documentVersion: DOCUMENT_VERSION,
      screenId: project.screens[0].screenId,
      graphs: {
        binding: {
          rootVertexId: "trigger-cache",
          nodes: [{
            id: "trigger-cache",
            kind: "trigger" as const,
            type: "ApiService",
            label: "Fetch",
            properties: {},
            persistence: {
              localRuntime: true,
              pilotRuntime: false,
              globalRuntime: false,
              extensions: { cacheKey: "movies" },
            },
          }],
          edges: [],
          selectedNodeId: "trigger-cache",
        },
      },
    };

    await repository.saveCatalogItem(ownerA, projectId, catalogItem);
    await repository.saveTheme(ownerA, projectId, theme);
    await repository.saveTriggerGraphs(ownerA, projectId, graph);
    const loaded = await repository.load(ownerA, projectId);

    expect(loaded.catalogItems).toEqual([catalogItem]);
    expect(loaded.theme).toEqual(theme);
    expect(
      loaded.triggerGraphs[graph.screenId].graphs.binding.nodes[0].persistence,
    ).toEqual({
      localRuntime: true,
      pilotRuntime: false,
      globalRuntime: false,
      extensions: { cacheKey: "movies" },
    });
  });

  it("autosaves an affected layout and restores it after reload", async () => {
    const repository = new InMemoryLocalProjectRepository();
    const project = await createProject(repository, ownerA, "Autosave Project");
    const projectId = project.manifest.projectId;
    const screenId = project.screens[0].screenId;
    const changed: LayoutDocument = {
      ...project.layouts[screenId],
      tree: { ...project.layouts[screenId].tree, id: "autosaved-body" },
    };
    const coordinator = new AutosaveCoordinator({ debounceMs: 0 });

    coordinator.schedule("layout:" + screenId, () =>
      repository.saveLayout(ownerA, projectId, changed),
    );
    await coordinator.flush();

    await expect(repository.load(ownerA, projectId)).resolves.toMatchObject({
      layouts: {
        [screenId]: changed,
      },
    });
  });

  it("stores resources byte-for-byte and deduplicates by sha256", async () => {
    const projects = new InMemoryLocalProjectRepository();
    const resources = new InMemoryResourceRepository(projects);
    const project = await createProject(projects, ownerA, "Resources Project");
    const projectId = project.manifest.projectId;
    const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);

    const first = await resources.put({
      ownerId: ownerA,
      projectId,
      name: "aircraft.bin",
      mimeType: "application/octet-stream",
      bytes,
    });
    const second = await resources.put({
      ownerId: ownerA,
      projectId,
      name: "aircraft-copy.bin",
      mimeType: "application/octet-stream",
      bytes: bytes.slice(),
    });

    expect(second).toEqual(first);
    expect(await resources.list(ownerA, projectId)).toHaveLength(1);
    expect(await resources.read(ownerA, projectId, first.resourceId)).toEqual(bytes);
    expect((await projects.load(ownerA, projectId)).resources.resources).toHaveLength(1);
  });
});
