export const PROJECT_STATUSES = [
  "ACTIVE",
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_ICON_TYPES = [
  "SHOPPING_CART",
  "USERS",
  "WALLET",
  "TRUCK",
  "CHART",
  "LAYOUT",
] as const;

export type ProjectIconType = (typeof PROJECT_ICON_TYPES)[number];

export const PROJECT_ACCENTS = [
  "BLUE",
  "PURPLE",
  "GREEN",
  "ORANGE",
  "PINK",
] as const;

export type ProjectAccent = (typeof PROJECT_ACCENTS)[number];

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  screensCount: number;
  updatedAt: string;
  icon: ProjectIconType;
  accent: ProjectAccent;
  ownerId: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  userId: string;
}

export interface ProjectSummary {
  totalProjects: number;
  editingProjects: number;
  publishedProjects: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isProjectStatus = (value: unknown): value is ProjectStatus =>
  typeof value === "string" &&
  PROJECT_STATUSES.some((status) => status === value);

export const isProjectIconType = (
  value: unknown,
): value is ProjectIconType =>
  typeof value === "string" &&
  PROJECT_ICON_TYPES.some((icon) => icon === value);

export const isProjectAccent = (value: unknown): value is ProjectAccent =>
  typeof value === "string" &&
  PROJECT_ACCENTS.some((accent) => accent === value);

export const isProject = (value: unknown): value is Project => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.description === "string" &&
    isProjectStatus(value.status) &&
    typeof value.screensCount === "number" &&
    Number.isInteger(value.screensCount) &&
    value.screensCount >= 0 &&
    typeof value.updatedAt === "string" &&
    !Number.isNaN(Date.parse(value.updatedAt)) &&
    isProjectIconType(value.icon) &&
    isProjectAccent(value.accent) &&
    typeof value.ownerId === "string" &&
    value.ownerId.length > 0
  );
};
