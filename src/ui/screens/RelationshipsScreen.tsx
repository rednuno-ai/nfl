import { useGameStore } from "@store/gameStore";
import { AttributeBar } from "../components/AttributeBar";

const TYPE_LABELS: Record<string, string> = {
  coach: "Coach",
  teammate: "Teammates",
  family: "Family",
  friend: "Friends",
  agent: "Agent",
  partner: "Partner",
  media: "Media",
  booster: "Booster",
};

const MILESTONE_TAGS = ["in_relationship", "married", "has_child", "owns_house", "owns_luxury_car", "has_investments", "team_captain"];

export function RelationshipsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const milestones = state.tags.filter((t) => MILESTONE_TAGS.includes(t));

  return (
    <div>
      <div className="page-title">People</div>
      <p className="page-subtitle">The relationships shaping your career.</p>

      <div className="card">
        {state.relationships.map((r) => (
          <AttributeBar key={r.id} label={`${r.name} (${TYPE_LABELS[r.type] ?? r.type})`} value={r.value} />
        ))}
        {state.relationships.length === 0 && <p className="faint">No tracked relationships yet.</p>}
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        Life Milestones
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {milestones.map((t) => (
            <span className="badge badge-accent" key={t}>
              {t.replace(/_/g, " ")}
            </span>
          ))}
          {milestones.length === 0 && <span className="faint">Nothing yet — life off the field is just getting started.</span>}
        </div>
      </div>
    </div>
  );
}
