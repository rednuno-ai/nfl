import { useGameStore, gameStore } from "@store/gameStore";
import { AttributeBar } from "../components/AttributeBar";

const TYPE_LABELS: Record<string, string> = { coach: "Coach", teammate: "Teammates", family: "Family", friend: "Friends", agent: "Agent", partner: "Partner", media: "Media", booster: "Booster" };
const MILESTONE_TAGS = ["in_relationship", "married", "has_child", "owns_house", "owns_luxury_home", "owns_car", "owns_luxury_car", "has_investments", "team_captain"];
const MILESTONE_LABELS: Record<string, string> = {
  in_relationship: "In a Relationship", married: "Married", has_child: "Has a Child", owns_house: "Owns a Home", owns_luxury_home: "Owns a Luxury Home", owns_car: "Owns a Vehicle", owns_luxury_car: "Owns a High-End Car", has_investments: "Has Investments", team_captain: "Team Captain",
};

export function RelationshipsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const milestones = state.tags.filter((tag) => MILESTONE_TAGS.includes(tag));
  const partner = state.relationships.find((relationship) => relationship.type === "partner");
  const canDate = state.player.bio.age >= 17;

  return (
    <div className="relationships-screen">
      <div className="life-people-hero">
        <div className="life-people-hero-art" aria-hidden="true" />
        <div className="life-people-hero-copy">
          <div className="screen-eyebrow">OFF THE FIELD</div>
          <div className="page-title">Your Circle</div>
          <p className="page-subtitle">Family, friendships, relationships and the attention around them evolve through your choices.</p>
        </div>
      </div>

      <div className="life-choice-grid">
        <section className="card life-choice-card">
          <div className="life-card-kicker">PERSONAL LIFE</div>
          <div className="section-title">{partner ? partner.name : "Write your own story"}</div>
          <p className="faint life-card-description">
            {partner ? `Your relationship is at ${partner.value}/100. You decide whether it grows, changes, or stays private.` : "A relationship is optional. Meet someone when it feels right, or keep the focus entirely on football."}
          </p>
          {canDate ? (
            <div className="life-action-row">
              <button className="btn btn-primary" onClick={() => gameStore.getState().startOrChangePartner()}>{partner ? "Meet someone new" : "Meet someone"}</button>
              {partner && <button className="btn" onClick={() => gameStore.getState().endPartnerRelationship()}>End relationship</button>}
            </div>
          ) : <p className="faint">Personal-life choices unlock at age 17.</p>}
        </section>

        <section className="card life-choice-card life-press-choice">
          <div className="life-card-kicker">THE HEADLINES</div>
          <div className="section-title">Paparazzi outside</div>
          <p className="faint life-card-description">A camera crew catches your night out. Set a boundary or own the moment — media chemistry and reputation respond either way.</p>
          <div className="life-action-row">
            <button className="btn" onClick={() => gameStore.getState().respondToPaparazzi("private")}>Keep it private</button>
            <button className="btn btn-primary" onClick={() => gameStore.getState().respondToPaparazzi("embrace")}>Own the moment</button>
          </div>
        </section>
      </div>

      <section className="card life-relationship-list">
        <div className="life-card-heading"><div><div className="life-card-kicker">CONNECTIONS</div><div className="section-title">People who shape the journey</div></div></div>
        {state.relationships.map((relationship) => <AttributeBar key={relationship.id} label={`${relationship.name} (${TYPE_LABELS[relationship.type] ?? relationship.type})`} value={relationship.value} />)}
        {state.relationships.length === 0 && <p className="faint">No tracked relationships yet.</p>}
      </section>

      <div className="section-title" style={{ marginTop: 22 }}>Life Milestones</div>
      <section className="card">
        <div className="life-milestones">
          {milestones.map((tag) => <span className="badge badge-accent" key={tag}>{MILESTONE_LABELS[tag] ?? tag.replace(/_/g, " ")}</span>)}
          {milestones.length === 0 && <span className="faint">Nothing yet — life off the field is just getting started.</span>}
        </div>
      </section>
    </div>
  );
}
