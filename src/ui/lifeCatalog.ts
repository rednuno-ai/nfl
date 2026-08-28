import type { Asset } from "@engine/types";

export type LifeAssetForSale = Omit<Asset, "id" | "purchasedWeek"> & {
  tier: string;
  tagline: string;
};

// The catalogue uses original, fictional products. It gives the player the
// familiar progression from everyday transport to a halo car without using a
// real manufacturer, model name, badge, or dealership licence.
export const VEHICLE_CATALOG: LifeAssetForSale[] = [
  { name: "Metro One", type: "car", value: 14_500, weeklyUpkeep: 18, weeklyReturn: 0, tier: "Everyday", tagline: "First keys. Low running costs, all yours." },
  { name: "Ridge Compact", type: "car", value: 27_000, weeklyUpkeep: 26, weeklyReturn: 0, tier: "Daily", tagline: "A sharp, comfortable step up for the commute." },
  { name: "Solstice Coupe", type: "car", value: 51_000, weeklyUpkeep: 48, weeklyReturn: 0, tier: "Performance", tagline: "Quick enough to turn a quiet arrival into a moment." },
  { name: "Apex GT", type: "car", value: 118_000, weeklyUpkeep: 96, weeklyReturn: 0, tier: "Elite", tagline: "Touring power, tailored cabin, zero compromise." },
  { name: "Velocity R", type: "car", value: 295_000, weeklyUpkeep: 220, weeklyReturn: 0, tier: "Halo", tagline: "A rare flagship for a career that changed the game." },
];

export const HOME_CATALOG: LifeAssetForSale[] = [
  { name: "Rookie Studio", type: "house", value: 82_000, weeklyUpkeep: 28, weeklyReturn: 0, tier: "Start", tagline: "Your own place, close to the facility." },
  { name: "Garden Townhome", type: "house", value: 260_000, weeklyUpkeep: 74, weeklyReturn: 0, tier: "Home", tagline: "Room to reset, host friends, and build a routine." },
  { name: "Modern Hillside", type: "house", value: 760_000, weeklyUpkeep: 175, weeklyReturn: 0, tier: "Premium", tagline: "A quiet view, a full gym, and space to breathe." },
  { name: "Crest Estate", type: "house", value: 2_450_000, weeklyUpkeep: 460, weeklyReturn: 0, tier: "Legacy", tagline: "A private compound made for the long game." },
];

export const OFF_FIELD_ASSETS: LifeAssetForSale[] = [
  { name: "Index Fund Portfolio", type: "investment", value: 100_000, weeklyUpkeep: 0, weeklyReturn: 180, tier: "Finance", tagline: "Steady off-field compounding." },
  { name: "Neighbourhood Restaurant Stake", type: "business", value: 200_000, weeklyUpkeep: 40, weeklyReturn: 320, tier: "Business", tagline: "A local venture with long-term upside." },
];

export const ASSET_ICON: Record<string, string> = {
  house: "⌂",
  car: "▰",
  investment: "↗",
  business: "◫",
};

export const ASSET_LABEL: Record<string, string> = {
  house: "Home",
  car: "Vehicle",
  investment: "Investment",
  business: "Business",
};
