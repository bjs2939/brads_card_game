import type { Rank } from "./game_engine/types";

// Coordinates are percentages of the map image, measured from its top-left corner.
export type CampaignStage = { id: string; rank: Rank; location: string; opponent: string; x: number; y: number };
export const campaignStages: CampaignStage[] = [
  { id: "halfling-shire", rank: "2", location: "Halfling Shire", opponent: "Halfling King", x: 15, y: 17 },
  { id: "rat-king", rank: "3", location: "Rat King", opponent: "Rat King", x: 48, y: 19 },
  { id: "soldiers-guild", rank: "4", location: "Soldiers Guild", opponent: "Grand Commander", x: 79, y: 20 },
  { id: "combat-engineers", rank: "5", location: "Combat Engineers", opponent: "Master Combat Engineer", x: 89, y: 47 },
  { id: "rangers-guild", rank: "6", location: "Rangers Guild", opponent: "Ranger Captain", x: 52, y: 49 },
  { id: "holy-knight-sanctuary", rank: "7", location: "Holy Knight Sanctuary", opponent: "Grand Templar", x: 26, y: 49 },
  { id: "enchanted-riders", rank: "8", location: "Enchanted Riders", opponent: "Master of the Enchanted Riders", x: 16, y: 78 },
  { id: "legendary-warriors", rank: "9", location: "Legendary Warriors", opponent: "Legendary Champion", x: 55, y: 81 },
  { id: "dragons-lair", rank: "10", location: "Dragon's Lair", opponent: "Ancient Dragon King", x: 86, y: 83 },
];
