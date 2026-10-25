import type { StruggleCategory } from "./types";

export const FAITH_CATEGORIES = [
  {
    id: "temptation",
    label: "Temptation",
    description: "Small, honest steps for choosing what is life-giving when temptation gets loud.",
    accent: "coral",
  },
  {
    id: "family",
    label: "Family",
    description: "Practices for bringing patience, truth, and grace into difficult family moments.",
    accent: "acid",
  },
  {
    id: "anxiety",
    label: "Anxiety",
    description: "Grounded encouragement for meeting anxious thoughts with prayer and wise support.",
    accent: "violet",
  },
  {
    id: "doubt",
    label: "Doubt",
    description: "Room to ask honest questions while continuing to seek Jesus with humility.",
    accent: "blue",
  },
  {
    id: "loneliness",
    label: "Loneliness",
    description: "Gentle next steps toward God and trustworthy people when you feel alone.",
    accent: "gold",
  },
  {
    id: "forgiveness",
    label: "Forgiveness",
    description: "A practical path for receiving grace, naming harm, and choosing wise repair.",
    accent: "peach",
  },
  {
    id: "prayer",
    label: "Prayer",
    description: "Simple ways to turn toward God with honesty when you do not know what to say.",
    accent: "green",
  },
  {
    id: "spiritual-growth",
    label: "Spiritual Growth",
    description: "Steady rhythms that help faith become a lived response to Jesus in ordinary days.",
    accent: "ink",
  },
] as const satisfies readonly StruggleCategory[];

export const STRUGGLE_CATEGORIES = FAITH_CATEGORIES;
export const categories = FAITH_CATEGORIES;

export type StruggleCategoryId = (typeof FAITH_CATEGORIES)[number]["id"];

export function getCategoryById(
  categoryId: string,
): (typeof FAITH_CATEGORIES)[number] | undefined {
  return FAITH_CATEGORIES.find((category) => category.id === categoryId);
}
