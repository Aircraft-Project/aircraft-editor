import components from "./components.json";
import contexts from "./contexts.json";
import index from "./schema-index.json";
import manifest from "./manifest.json";
import triggers from "./triggers.json";

export const snapshotV1: unknown = {
  manifest,
  index,
  components,
  triggers,
  contexts,
};
