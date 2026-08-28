import type { CareerState } from "./career";
import { computeOverall } from "./attributes";

export interface JourneyPillar {
  label: "Skill" | "Legacy" | "Popularity";
  value: number;
  description: string;
}

export interface CareerJourney {
  chapter: string;
  nextStep: string;
  pillars: JourneyPillar[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** A compact, read-only career compass. It surfaces existing progression data
 * rather than inventing another currency or a second upgrade tree. */
export function getCareerJourney(state: CareerState): CareerJourney {
  const overall = computeOverall(state.player.attributes, state.player.position);
  const accolades = state.achievements.filter((achievement) => achievement.unlockedWeek !== null).length;
  const championships = state.statHistory.filter((line) => line.championshipWon).length;
  const legacy = clamp(accolades * 7 + championships * 12 + state.careerSeasonsPlayed * 3 + state.seasonRecord.wins * 1.5);
  const popularity = clamp((state.player.attributes.general.fame + state.player.attributes.general.reputation) / 2);

  let chapter = "Friday Night Potential";
  let nextStep = "Build your highlight tape and earn a scholarship offer.";
  if (state.stage === "recruiting") {
    chapter = "Choose Your Path";
    nextStep = "Pick the program that gives your career the best launchpad.";
  } else if (state.stage === "college") {
    chapter = "Campus Star";
    nextStep = "Win the trust of your coach and turn strong weeks into draft stock.";
  } else if (state.stage === "draft") {
    chapter = "Draft Night";
    nextStep = "Make every interview and combine week count.";
  } else if (state.stage === "free_agency") {
    chapter = "The Market";
    nextStep = "Choose the contract, role and contender that fit your next chapter.";
  } else if (state.stage === "nfl_offseason") {
    chapter = "Build The Next Version";
    nextStep = "Use the offseason to sharpen your edge before camp.";
  } else if (state.stage === "nfl_season") {
    chapter = state.careerSeasonsPlayed >= 5 ? "Chasing Immortality" : "Proving Ground";
    nextStep = state.careerSeasonsPlayed >= 5 ? "Stack awards, championships and defining performances." : "Turn weekly performances into a place among the league's best.";
  } else if (state.stage === "retired") {
    chapter = "Career Complete";
    nextStep = "Review the legacy you left behind.";
  }

  return {
    chapter,
    nextStep,
    pillars: [
      { label: "Skill", value: overall, description: "Overall ability" },
      { label: "Legacy", value: legacy, description: "Awards, wins & longevity" },
      { label: "Popularity", value: popularity, description: "Fame & reputation" },
    ],
  };
}
