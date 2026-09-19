export type EditorWorkspace =
  | "components"
  | "screens"
  | "triggers"
  | "resources";

export type EditorResourceKind =
  | "image"
  | "icon"
  | "logo"
  | "palette"
  | "file";

export interface EditorResource {
  readonly id: string;
  readonly name: string;
  readonly kind: EditorResourceKind;
  readonly description: string;
  readonly size: string;
  readonly usedIn: readonly string[];
  readonly previewTone: "sky" | "cyan" | "light" | "document";
  readonly tags: readonly string[];
}
