import { type AppIcon, GridFour, GridNine, Square } from "@/shared/icons";

/** How big each candidate tile is on the exam monitoring grid. */
export type CardLayout = "small" | "medium" | "large";

type CardLayoutOption = {
  value: CardLayout;
  label: string;
  icon: AppIcon;
  /** Narrowest a tile may get before the grid drops a column. */
  minTileWidth: number;
  /** First-guess row height for the virtualized grid; rows are measured once rendered. */
  estimatedRowHeight: number;
};

export const CARD_LAYOUTS: CardLayoutOption[] = [
  {
    value: "small",
    label: "Small cards",
    icon: GridNine,
    minTileWidth: 180,
    estimatedRowHeight: 170,
  },
  {
    value: "medium",
    label: "Medium cards",
    icon: GridFour,
    minTileWidth: 300,
    estimatedRowHeight: 340,
  },
  {
    value: "large",
    label: "Large cards",
    icon: Square,
    minTileWidth: 560,
    estimatedRowHeight: 520,
  },
];

export const DEFAULT_CARD_LAYOUT: CardLayout = "medium";

export function cardLayoutOption(layout: CardLayout): CardLayoutOption {
  return CARD_LAYOUTS.find((o) => o.value === layout) ?? CARD_LAYOUTS[1];
}

export function isCardLayout(value: unknown): value is CardLayout {
  return CARD_LAYOUTS.some((o) => o.value === value);
}
