import {
  ChartNoAxesColumn,
  PanelsTopLeft,
  ShoppingCart,
  Truck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type {
  ProjectAccent,
  ProjectIconType,
  ProjectStatus,
} from "@/modules/projects";

export interface ProjectStatusVisual {
  label: string;
  tone: "active" | "draft" | "review" | "published";
}

export const PROJECT_STATUS_CONFIG: Readonly<
  Record<ProjectStatus, ProjectStatusVisual>
> = {
  ACTIVE: {
    label: "Activo",
    tone: "active",
  },
  DRAFT: {
    label: "Borrador",
    tone: "draft",
  },
  IN_REVIEW: {
    label: "En revisión",
    tone: "review",
  },
  PUBLISHED: {
    label: "Publicado",
    tone: "published",
  },
};

export const PROJECT_ICON_MAP: Readonly<
  Record<ProjectIconType, LucideIcon>
> = {
  SHOPPING_CART: ShoppingCart,
  USERS: UsersRound,
  WALLET: WalletCards,
  TRUCK: Truck,
  CHART: ChartNoAxesColumn,
  LAYOUT: PanelsTopLeft,
};

export const PROJECT_ACCENT_CLASS: Readonly<
  Record<ProjectAccent, Lowercase<ProjectAccent>>
> = {
  BLUE: "blue",
  PURPLE: "purple",
  GREEN: "green",
  ORANGE: "orange",
  PINK: "pink",
};
