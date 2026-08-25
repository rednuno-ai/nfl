import type { College } from "./types";

// =============================================================================
// Fictional college football universe. Same licensing rationale as teams.ts.
// =============================================================================

const RAW: Array<[string, string, string, string, number, number, number, number]> = [
  // name, mascot, conference, state, prestige, coaching, academics, exposure
  ["Eastridge State", "Hawks", "Coastal Conference", "NC", 88, 85, 70, 90],
  ["Westfield University", "Cougars", "Pacific Alliance", "CA", 90, 88, 78, 92],
  ["Grand Lakes University", "Timberwolves", "Great Lakes League", "MI", 82, 80, 74, 80],
  ["Prairie Central", "Bison", "Heartland Conference", "NE", 70, 68, 65, 55],
  ["Southport Tech", "Gators", "Gulf Coast Conference", "FL", 85, 82, 60, 88],
  ["Blue Ridge University", "Rams", "Appalachian Conference", "VA", 62, 60, 80, 45],
  ["Rio Verde State", "Roadrunners", "Desert Conference", "AZ", 58, 55, 62, 40],
  ["Northpoint University", "Wolves", "Great Lakes League", "MN", 65, 66, 76, 50],
  ["Capitol A&M", "Generals", "Coastal Conference", "VA", 74, 72, 70, 65],
  ["Lonestar Central", "Longhorned Steers", "Southwest Conference", "TX", 92, 90, 65, 95],
  ["Bayou Tech", "Crawdads", "Gulf Coast Conference", "LA", 78, 76, 55, 72],
  ["Mountain View State", "Elk", "Rocky Conference", "CO", 60, 58, 72, 42],
  ["Old Dominion Central", "Cavaliers", "Coastal Conference", "NC", 55, 54, 78, 35],
  ["Steel City University", "Ironmen", "Great Lakes League", "PA", 80, 79, 68, 78],
  ["Sun Valley University", "Suns", "Pacific Alliance", "AZ", 68, 65, 66, 58],
  ["Heartland A&M", "Cyclones", "Heartland Conference", "IA", 63, 62, 70, 46],
  ["Golden Coast University", "Seahawks", "Pacific Alliance", "CA", 76, 74, 74, 74],
  ["Magnolia State", "Rebels", "Gulf Coast Conference", "MS", 66, 64, 58, 52],
  ["Tri-State Poly", "Engineers", "Great Lakes League", "OH", 72, 71, 82, 60],
  ["Redwood University", "Loggers", "Pacific Alliance", "OR", 61, 60, 73, 41],
  ["Frontier State", "Pioneers", "Heartland Conference", "KS", 57, 56, 64, 33],
  ["Cascade University", "Peaks", "Rocky Conference", "WA", 64, 63, 75, 48],
  ["Palmetto A&M", "Herons", "Coastal Conference", "SC", 71, 70, 66, 62],
  ["Empire State Central", "Knights", "Northeast Conference", "NY", 79, 77, 80, 76],
  ["Granite Hill University", "Miners", "Northeast Conference", "NH", 52, 50, 77, 28],
  ["Sunbelt Tech", "Hornets", "Gulf Coast Conference", "GA", 83, 81, 62, 84],
  ["Rustbelt State", "Foundry Men", "Great Lakes League", "IN", 59, 58, 63, 38],
  ["Big Sky University", "Eagles", "Rocky Conference", "MT", 50, 49, 71, 24],
  ["Lakeshore Central", "Herons", "Great Lakes League", "WI", 67, 66, 76, 55],
  ["Delta A&M", "Catfish", "Gulf Coast Conference", "AR", 56, 55, 57, 31],
];

export const COLLEGES: College[] = RAW.map(([name, mascot, conference, state, prestige, coaching, academics, exposure], i) => ({
  id: `college_${i + 1}`,
  name,
  mascot,
  conference,
  state,
  prestige,
  coachingQuality: coaching,
  academics,
  exposure,
  developmentRate: 0.8 + (coaching / 100) * 0.6, // 0.8 - 1.4 multiplier
}));

export function getCollege(id: string): College | undefined {
  return COLLEGES.find((c) => c.id === id);
}

export function topCollegesByPrestige(count = 10): College[] {
  return [...COLLEGES].sort((a, b) => b.prestige - a.prestige).slice(0, count);
}
