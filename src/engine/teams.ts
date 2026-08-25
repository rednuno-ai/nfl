import type { Team } from "./types";

// =============================================================================
// Fictional NFL-analog league: 32 fictional teams, no real names/logos/cities
// mapped 1:1 to real teams. This lets NFL LIFE operate commercially without
// a league license. Swapping in a licensed dataset later only requires
// replacing this file — nothing else in the engine references real teams.
// =============================================================================

const CITIES = [
  "Ironpoint", "Brackenfield", "Saltmarsh", "Redgate", "Cinderfalls", "Wolverton",
  "Highcross", "Duskbridge", "Amberlynn", "Stonecrest", "Fairhaven", "Thornwick",
  "Graymoor", "Millhaven", "Sablewood", "Emberdale", "Frostpeak", "Copperfield",
  "Ravensburg", "Goldshire", "Marrowgate", "Sunreach", "Blackpool Hills", "Hollowmere",
  "Cliffport", "Windmere", "Ashford Bay", "Pinehollow", "Silverlake", "Rustford",
  "Bellcrest", "Northgate",
];

const NICKNAMES = [
  "Colossi", "Marauders", "Ironhawks", "Sentinels", "Wardens", "Cyclones",
  "Rattlers", "Kraken", "Outlaws", "Comets", "Vipers", "Barons",
  "Renegades", "Wolves", "Miners", "Talons", "Bison", "Nighthawks",
  "Sharks", "Griffins", "Ironhorns", "Rangers", "Scorpions", "Grizzlies",
  "Pioneers", "Blaze", "Stallions", "Cobras", "Mavericks", "Crushers",
  "Tempest", "Legion",
];

const COACHES = [
  "Marcus Doyle", "Ray Kowalski", "Terrence Ward", "Alan Brecht", "Devon Okafor",
  "Nick Farraday", "Curtis Hale", "Vince Palermo", "Greg Suarez", "Owen Mackey",
  "Darnell Osei", "Bill Trentham", "Marcus Voss", "Ellis Grant", "Tomas Reyes",
  "Roy Callahan", "Dana Whitfield", "Ken Iverson", "Pete Sandoval", "Anthony Blake",
  "Corey Nakamura", "Hank Delacroix", "Miles Radford", "Simon Otero", "Jake Winslow",
  "Ray Pemberton", "Dale Fenimore", "Trey Holloway", "Gus Marchetti", "Aaron Speight",
  "Colton Vance", "Nate Kessler",
];

const CONFERENCES: Team["conference"][] = ["National", "American"];

const DIVISIONS = ["North", "South", "East", "West"];

function buildTeams(): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i < 32; i++) {
    const conference = CONFERENCES[i % 2];
    const division = DIVISIONS[Math.floor(i / 2) % 4];
    const city = CITIES[i];
    const name = NICKNAMES[i];
    const seedBase = (i * 2654435761) % 100;
    teams.push({
      id: `team_${i + 1}`,
      city,
      name,
      abbreviation: (city.slice(0, 2) + name.slice(0, 1)).toUpperCase(),
      conference,
      division,
      prestige: 35 + (seedBase % 60),
      marketSize: 30 + ((seedBase * 7) % 65),
      coachingQuality: 40 + ((seedBase * 3) % 55),
      rosterStrength: 35 + ((seedBase * 5) % 60),
      headCoachName: COACHES[i],
    });
  }
  return teams;
}

export const TEAMS: Team[] = buildTeams();

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

export function teamsByProspectFit(interestSeed: number, count = 5): Team[] {
  // Deterministic-ish shortlist based on a seed number, used for draft interest.
  const sorted = [...TEAMS].sort((a, b) => ((a.prestige * interestSeed) % 97) - ((b.prestige * interestSeed) % 97));
  return sorted.slice(0, count);
}
