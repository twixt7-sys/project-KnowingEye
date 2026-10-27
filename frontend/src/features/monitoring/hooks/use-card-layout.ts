import { useState } from "react";

import {
  type CardLayout,
  DEFAULT_CARD_LAYOUT,
  isCardLayout,
} from "@/features/monitoring/lib/card-layout";

const STORAGE_KEY = "monitoring.cardLayout";

function readStoredLayout(): CardLayout {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCardLayout(stored) ? stored : DEFAULT_CARD_LAYOUT;
  } catch {
    return DEFAULT_CARD_LAYOUT;
  }
}

/** The proctor's chosen tile size, remembered in this browser across exams. */
export function useCardLayout() {
  const [layout, setLayoutState] = useState<CardLayout>(readStoredLayout);

  const setLayout = (next: CardLayout) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode, quota) - the choice still applies for this visit.
    }
  };

  return [layout, setLayout] as const;
}
