import type {
  LocalProjectRepository,
  ResourceRepository,
} from "../application";
import {
  ElectronLocalProjectRepository,
  ElectronResourceRepository,
  hasAircraftDesktopBridge,
} from "../infrastructure/ElectronLocalProjectRepository";
import {
  InMemoryLocalProjectRepository,
  InMemoryResourceRepository,
} from "../infrastructure/InMemoryLocalProjectRepository";

const memoryProjects = new InMemoryLocalProjectRepository();
const memoryResources = new InMemoryResourceRepository(memoryProjects);
const electronProjects = new ElectronLocalProjectRepository();
const electronResources = new ElectronResourceRepository();

export function getLocalProjectRepository(): LocalProjectRepository {
  return hasAircraftDesktopBridge()
    ? electronProjects
    : memoryProjects;
}

export function getResourceRepository(): ResourceRepository {
  return hasAircraftDesktopBridge()
    ? electronResources
    : memoryResources;
}
