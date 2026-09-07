import { useGameStore, gameStore } from "@store/gameStore";
import { AttributeBar } from "../components/AttributeBar";
import type { Relationship } from "@engine/types";

const TYPE_LABELS: Record<string, string> = { coach: "Coach", teammate: "Teammates", family: "Family", friend: "Friends", agent: "Agent", rival: "Rival", partner: "Partner", media: "Media", booster: "Booster" };
const MILESTONE_TAGS = ["in_relationship", "married", "has_child", "owns_house", "owns_luxury_home", "owns_car", "owns_luxury_car", "has_investments", "team_captain"];
const MILESTONE_LABELS: Record<string, string> = {
  in_relationship: "In a Relationship", married: "Married", has_child: "Has a Child", owns_house: "Owns a Home", owns_luxury_home: "Owns a Luxury Home", owns_car: "Owns a Vehicle", owns_luxury_car: "Owns a High-End Car", has_investments: "Has Investments", team_captain: "Team Captain",
};

function relationshipMeaning(value: number): string {
  if (value >= 80) return "Trusted";
  if (value >= 60) return "Strong";
  if (value >= 40) return "Unsettled";
  return "Strained";
}

function relationshipTrend(relationship: Relationship): { label: string; className: string } {
  const delta = relationship.history?.[0]?.delta ?? 0;
  if (delta > 0) return { label: "Rising", className: "relationship-trend-up" };
  if (delta < 0) return { label: "Falling", className: "relationship-trend-down" };
  return { label: "Steady", className: "relationship-trend-steady" };
}

export function RelationshipsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const milestones = state.tags.filter((tag) => MILESTONE_TAGS.includes(tag));
  const partner = state.relationships.find((relationship) => relationship.type === "partner");
  const canDate = state.player.bio.age >= 17;
  const latestHeadline = state.news[0];

  return (
    <div className="relationships-screen">
      <div className="life-people-hero">
        <div className="life-people-hero-art" aria-hidden="true" />
        <div className="life-people-hero-copy">
          <div className="screen-eyebrow">OFF THE FIELD</div>
          <h1 className="page-title">Your Circle</h1>
          <p className="page-subtitle">Relationships carry memory: each score reflects trust, and the latest cause explains its direction.</p>
        </div>
      </div>

      <div className="life-choice-grid">
        <section className="card life-choice-card" aria-labelledby="personal-life-heading">
          <div className="life-card-kicker">PERSONAL LIFE</div>
          <h2 id="personal-life-heading" className="section-title">{partner ? partner.name : "Write your own story"}</h2>
          <p className="faint life-card-description">{partner ? `Connection ${partner.value}/100 · ${relationshipMeaning(partner.value)}` : "Relationships are always player-led."}</p>
          {canDate ? (
            <div className="life-action-row">
              <button className="btn btn-primary" onClick={() => gameStore.getState().startOrChangePartner()}>{partner ? "Meet someone new" : "Meet someone"}</button>
              {partner && <button className="btn" onClick={() => gameStore.getState().endPartnerRelationship()}>End relationship</button>}
            </div>
          ) : <span className="life-availability">Available at age 17</span>}
        </section>

        <section className="card life-choice-card life-press-choice" aria-labelledby="headlines-heading">
          <div className="life-card-kicker">THE HEADLINES</div>
          <h2 id="headlines-heading" className="section-title">Headlines</h2>
          {latestHeadline ? (
            <>
              <p className="life-headline">{latestHeadline.headline}</p>
              <p className="faint life-card-description">{latestHeadline.body}</p>
            </>
          ) : <p className="faint life-card-description">Public attention appears only when your career earns it. No forced celebrity scenes.</p>}
        </section>
      </div>

      <section className="card life-relationship-list" aria-labelledby="connections-heading">
        <div className="life-card-heading"><div><div className="life-card-kicker">CONNECTIONS</div><h2 id="connections-heading" className="section-title">People who shape the journey</h2></div></div>
        <p className="faint relationship-scale">80–100 trusted · 60–79 strong · 40–59 unsettled · below 40 strained.</p>
        {state.relationships.map((relationship) => {
          const latest = relationship.history?.[0];
          const trend = relationshipTrend(relationship);
          return (
            <div className="relationship-entry" key={relationship.id}>
              <AttributeBar label={`${relationship.name} (${TYPE_LABELS[relationship.type] ?? relationship.type})`} value={relationship.value} />
              <div className="relationship-context">
                <span className="relationship-meaning">{relationshipMeaning(relationship.value)}</span>
                <span className={trend.className}>{trend.label}</span>
                <span className="relationship-cause">{latest ? `Last change: ${latest.note}` : "No change recorded yet."}</span>
              </div>
            </div>
          );
        })}
        {state.relationships.length === 0 && <p className="faint">No tracked relationships yet.</p>}
      </section>

      <section className="card life-milestones-card" aria-labelledby="milestones-heading">
        <div className="life-card-kicker">MILESTONES</div>
        <h2 id="milestones-heading" className="section-title">Career and life milestones</h2>
        <div className="life-milestones">
          {milestones.map((tag) => <span className="badge badge-accent" key={tag}>{MILESTONE_LABELS[tag] ?? tag.replace(/_/g, " ")}</span>)}
          {milestones.length === 0 && <span className="faint">No milestones yet.</span>}
        </div>
      </section>
    </div>
  );
}
