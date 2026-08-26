import { useGameStore, gameStore } from "@store/gameStore";
import type { CareerState } from "@engine/career";
import { computeOverall } from "@engine/attributes";
import { getCollege } from "@engine/colleges";
import { getTeam } from "@engine/teams";
import { money, moneyCompact, STAGE_LABELS } from "../format";
import { weeklySalary } from "@engine/contracts";
import { TeamCrest } from "@ui/components/TeamCrest";
import { PositionBadge } from "@ui/components/PositionBadge";

function currentSchoolOrTeamLabel(state: CareerState): string {
  if (state.stage === "high_school" || state.stage === "recruiting") return state.highSchool.schoolName;
  if (state.stage === "college" && state.college) return getCollege(state.college.collegeId)?.name ?? "College";
  if (state.stage === "draft") return "NFL Draft Prospect";
  if (state.team) return `${state.team.city} ${state.team.name}`;
  if (state.stage === "free_agency") return "Free Agent";
  return "Retired";
}

/** A crest seed+label for whatever program the player currently belongs to,
 *  or null when there isn't one yet (draft process, free agency, retired) —
 *  those fall back to a position badge instead. */
function currentCrestSeed(state: CareerState): { seed: string; label: string } | null {
  if (state.stage === "high_school" || state.stage === "recruiting") return { seed: state.highSchool.schoolName, label: state.highSchool.schoolName };
  if (state.stage === "college" && state.college) {
    const college = getCollege(state.college.collegeId);
    return { seed: state.college.collegeId, label: college?.mascot ?? college?.name ?? "College" };
  }
  if (state.team) return { seed: state.team.id, label: state.team.abbreviation };
  return null;
}

export function DashboardScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const overall = computeOverall(state.player.attributes, state.player.position);
  const nextGame = state.schedule.find((s) => s.week === state.weekInSeason && !s.played);
  const crestSeed = currentCrestSeed(state);

  return (
    <div>
      <div className="player-hero card">
        {crestSeed ? <TeamCrest seed={crestSeed.seed} label={crestSeed.label} size={56} /> : <PositionBadge position={state.player.position} size={56} />}
        <div className="player-hero-ovr">
          <div className="player-hero-ovr-number">{overall}</div>
          <div className="player-hero-ovr-label">OVR</div>
        </div>
        <div className="player-hero-info">
          <div className="player-hero-name">
            {state.player.bio.firstName} {state.player.bio.lastName}
          </div>
          <div className="player-hero-sub">
            <span className="player-hero-pos">{state.player.position}</span>
            {currentSchoolOrTeamLabel(state)} · Age {state.player.bio.age}
          </div>
          <span className="badge badge-accent" style={{ marginTop: 8, display: "inline-block" }}>
            {STAGE_LABELS[state.stage] ?? state.stage}
          </span>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        <div className="stat-tile">
          <div className="value">{Math.round(state.player.attributes.general.fame)}</div>
          <div className="label">Fame</div>
        </div>
        <div className="stat-tile">
          <div className="value">
            {state.seasonRecord.wins}-{state.seasonRecord.losses}
            {state.seasonRecord.ties ? `-${state.seasonRecord.ties}` : ""}
          </div>
          <div className="label">Season Record</div>
        </div>
        <div className="stat-tile">
          <div className="value">{moneyCompact(state.finance.netWorth)}</div>
          <div className="label">Net Worth</div>
        </div>
      </div>

      {state.stage === "recruiting" && <RecruitingBoard state={state} />}
      {state.stage === "draft" && <DraftRoom state={state} />}
      {state.stage === "free_agency" && <FreeAgencyBoard state={state} />}
      {(state.stage === "high_school" || state.stage === "college" || state.stage === "nfl_season" || state.stage === "nfl_offseason") && (
        <NormalDashboard state={state} nextGame={nextGame} />
      )}
      {state.stage === "retired" && (
        <div className="card">
          <div className="section-title">Career Complete</div>
          <p className="muted">Your playing days are over. Head to the Legacy tab to see how it all added up.</p>
          <button className="btn btn-primary" onClick={() => gameStore.getState().navigate("legacy")}>
            View Legacy
          </button>
        </div>
      )}

      <RecentEvents state={state} />
    </div>
  );
}

function NormalDashboard({ state, nextGame }: { state: CareerState; nextGame: ReturnType<CareerState["schedule"]["find"]> }) {
  const contract = state.contract;
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="card">
        <div className="section-title">Attributes</div>
        <AttributeSummary state={state} />
      </div>
      <div className="card">
        <div className="section-title">This Week</div>
        {nextGame ? (
          <p className="muted">
            Week {nextGame.week}: {nextGame.isHome ? "vs" : "at"} <strong style={{ color: "var(--text)" }}>{nextGame.opponentLabel}</strong>
          </p>
        ) : (
          <p className="muted">No game scheduled this week — training / offseason work.</p>
        )}
        {contract && (
          <p className="faint" style={{ marginTop: 6 }}>
            Contract: {contract.years - contract.currentYear} year(s) left · weekly salary {money(weeklySalary(contract))}
          </p>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => gameStore.getState().advance()}>
          Advance Week
        </button>
      </div>
    </div>
  );
}

function AttributeSummary({ state }: { state: CareerState }) {
  const { general, physical, mental } = state.player.attributes;
  const rows: [string, number][] = [
    ["Speed", physical.speed],
    ["Strength", physical.strength],
    ["Agility", physical.agility],
    ["Stamina", physical.stamina],
    ["Football IQ", mental.footballIQ],
    ["Confidence", general.confidence],
    ["Discipline", general.discipline],
    ["Leadership", general.leadership],
  ];
  return (
    <div>
      {rows.map(([label, value]) => (
        <div className="attr-row" key={label}>
          <div className="attr-label">{label}</div>
          <div className="attr-bar-track">
            <div className="attr-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
          </div>
          <div className="attr-value">{Math.round(value)}</div>
        </div>
      ))}
    </div>
  );
}

function RecruitingBoard({ state }: { state: CareerState }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-title">Choose Your College</div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Your high school career is over. {state.recruitingOffers.length} program(s) have offered you a scholarship.
      </p>
      <div className="list">
        {state.recruitingOffers.map((offer) => (
          <div className="list-item" key={offer.collegeId}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TeamCrest seed={offer.collegeId} label={offer.collegeName} size={36} />
              <div>
                <div style={{ fontWeight: 700 }}>{offer.collegeName}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>
                  Interest {offer.interestLevel}% {offer.scholarship ? "· Full scholarship" : ""}
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => gameStore.getState().commitCollege(offer.collegeId)}>
              Commit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftRoom({ state }: { state: CareerState }) {
  const projection = state.draftProjection;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-title">NFL Draft Process</div>
      {projection && (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="stat-tile">
            <div className="value">
              R{projection.projectedRoundLow}-{projection.projectedRoundHigh}
            </div>
            <div className="label">Projected Round</div>
          </div>
          <div className="stat-tile">
            <div className="value">{projection.stock}</div>
            <div className="label">Draft Stock</div>
          </div>
          <div className="stat-tile">
            <div className="value">{projection.interestedTeamIds.length}</div>
            <div className="label">Interested Teams</div>
          </div>
        </div>
      )}
      {state.draftResult ? (
        <p className="muted">
          {state.draftResult.round === 0
            ? "You went undrafted — a free agent deal is waiting."
            : `Drafted: Round ${state.draftResult.round}, Pick ${state.draftResult.pick}.`}
        </p>
      ) : (
        <p className="muted">Week {state.draftWeekInProcess} of the pre-draft process. Combine, interviews, and mock drafts continue.</p>
      )}
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => gameStore.getState().advance()}>
        Advance Week
      </button>
    </div>
  );
}

function FreeAgencyBoard({ state }: { state: CareerState }) {
  const offers = state.freeAgencyOffers ?? [];
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-title">Free Agency Offers</div>
      <div className="list">
        {offers.map((offer) => (
          <div className="list-item" key={offer.teamId}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TeamCrest seed={offer.teamId} label={getTeam(offer.teamId)?.abbreviation ?? offer.teamId} size={36} />
              <div>
                <div style={{ fontWeight: 700 }}>
                  {getTeam(offer.teamId) ? `${getTeam(offer.teamId)!.city} ${getTeam(offer.teamId)!.name}` : offer.teamId}
                </div>
                <div className="faint" style={{ fontSize: 12.5 }}>
                  {offer.contract.years} yrs · {money(offer.contract.totalValue)} total · {money(offer.contract.guaranteedMoney)} guaranteed · {offer.role} role · {Math.round(offer.championshipProbability * 100)}% title odds
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => gameStore.getState().signFreeAgent(offer.teamId)}>
              Sign
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentEvents({ state }: { state: CareerState }) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="section-title">Recent Events</div>
      <div className="list">
        {state.log.slice(0, 8).map((entry, i) => (
          <div className="faint" key={i} style={{ fontSize: 13 }}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
