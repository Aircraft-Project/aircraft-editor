export const AIRCRAFT_LOCAL_PROJECT_STORE_VERSION = 1 as const;
export const AIRCRAFT_LOCAL_PROJECT_STORE_MARKER =
  ".aircraft-local-store.json" as const;

export interface AircraftLocalProjectStoreConfig {
  readonly storageVersion: typeof AIRCRAFT_LOCAL_PROJECT_STORE_VERSION;
}

export const DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG:
  AircraftLocalProjectStoreConfig = {
    storageVersion: AIRCRAFT_LOCAL_PROJECT_STORE_VERSION,
  };
