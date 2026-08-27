import { useState } from "react";
import { gameStore } from "@store/gameStore";
import { MVP_POSITIONS, type Hand, type PersonalityTrait, type Position } from "@engine/types";
import { PERSONALITY_LABELS } from "@engine/player";
import { POINT_BUY_BASELINE, POINT_BUY_MAX, POINT_BUY_POOL, POINT_BUY_SLOTS, previewPointBuyOverall } from "@engine/attributes";
import { PositionBadge } from "@ui/components/PositionBadge";

const PERSONALITY_OPTIONS = Object.keys(PERSONALITY_LABELS) as PersonalityTrait[];
const US_STATES = ["TX", "CA", "FL", "OH", "GA", "PA", "NC", "MI", "LA", "AL", "TN", "AZ", "NY", "IL", "VA"];

export function CreatePlayerScreen() {
  const [step, setStep] = useState<"bio" | "attributes">("bio");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("TX");
  const [hand, setHand] = useState<Hand>("right");
  const [heightInches, setHeightInches] = useState(72);
  const [weightLbs, setWeightLbs] = useState(200);
  const [personality, setPersonality] = useState<PersonalityTrait[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const canSubmitBio = firstName.trim().length > 0 && lastName.trim().length > 0 && city.trim().length > 0 && personality.length > 0 && personality.length <= 3;

  const slots = POINT_BUY_SLOTS[position] ?? [];
  const pointsSpent = slots.reduce((sum, slot) => sum + (allocations[slot.path] ?? 0), 0);
  const pointsLeft = POINT_BUY_POOL - pointsSpent;
  const previewOverall = previewPointBuyOverall(position, allocations);

  function togglePersonality(trait: PersonalityTrait) {
    setPersonality((prev) => (prev.includes(trait) ? prev.filter((t) => t !== trait) : prev.length < 3 ? [...prev, trait] : prev));
  }

  function adjustPoint(path: string, delta: number) {
    setAllocations((prev) => {
      const current = prev[path] ?? 0;
      const next = current + delta;
      if (next < 0 || next > POINT_BUY_MAX - POINT_BUY_BASELINE) return prev;
      if (delta > 0 && pointsLeft <= 0) return prev;
      return { ...prev, [path]: next };
    });
  }

  function goToAttributes() {
    if (!canSubmitBio) return;
    // No reset needed here: pointsSpent/applyPointBuy only ever read the
    // *current* position's own slots (see POINT_BUY_SLOTS[position] above),
    // so a leftover allocation keyed to a different position's path is just
    // inert data — and if the new position happens to share a path with the
    // old one (e.g. "physical.speed" on both RB and WR), carrying that
    // allocation over is the correct, expected behavior, not a bug.
    setStep("attributes");
  }

  async function handleSubmit() {
    if (!canSubmitBio) return;
    setSubmitting(true);
    await gameStore.getState().startNewCareer({
      firstName,
      lastName,
      position,
      hometownCity: city,
      hometownState: stateName,
      hand,
      heightInches,
      weightLbs,
      personality,
      currentYear: new Date().getFullYear(),
      attributeAllocations: allocations,
    });
    setSubmitting(false);
  }

  if (step === "attributes") {
    return (
      <div className="centered-page">
        <div className="onboarding-card card">
          <div className="page-title">Build Your Player</div>
          <p className="page-subtitle">
            Distribute {POINT_BUY_POOL} points across your {position}'s standout attributes. Everything else is rolled at random,
            same as any prospect.
          </p>

          <div className="ovr-preview-card">
            <div className="ovr-preview-label">OVERALL</div>
            <div className="ovr-preview-number">{previewOverall}</div>
            <div className={`points-left ${pointsLeft === 0 ? "points-left-done" : ""}`}>{pointsLeft} points left</div>
          </div>

          <div className="attribute-list">
            {slots.map((slot) => {
              const value = POINT_BUY_BASELINE + (allocations[slot.path] ?? 0);
              return (
                <div className="attribute-row" key={slot.path}>
                  <div className="attribute-row-label">{slot.label}</div>
                  <button type="button" className="attribute-step" onClick={() => adjustPoint(slot.path, -2)} disabled={(allocations[slot.path] ?? 0) <= 0}>
                    −
                  </button>
                  <div className="attribute-bar-track">
                    <div className="attribute-bar-fill" style={{ width: `${value}%` }} />
                    <span className="attribute-value">{value}</span>
                  </div>
                  <button
                    type="button"
                    className="attribute-step"
                    onClick={() => adjustPoint(slot.path, 2)}
                    disabled={pointsLeft <= 0 || value >= POINT_BUY_MAX}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep("bio")}>
              Back
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Starting…" : "Start Career"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-page">
      <div className="onboarding-card card">
        <div className="page-title">Create Your Player</div>
        <p className="page-subtitle">Freshman year, age 15. This is where your career begins.</p>

        <div className="grid grid-2">
          <div className="field">
            <label>First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" maxLength={24} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Reed" maxLength={24} />
          </div>
        </div>

        <div className="field">
          <label>Position</label>
          <div className="pill-select">
            {MVP_POSITIONS.map((p) => (
              <button
                key={p}
                className={`pill-option pill-option-position ${position === p ? "selected" : ""}`}
                onClick={() => setPosition(p)}
                type="button"
              >
                <PositionBadge position={p} size={22} />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Hometown city</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ironpoint" maxLength={30} />
          </div>
          <div className="field">
            <label>State</label>
            <select value={stateName} onChange={(e) => setStateName(e.target.value)}>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-3">
          <div className="field">
            <label>Dominant hand</label>
            <select value={hand} onChange={(e) => setHand(e.target.value as Hand)}>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
          <div className="field">
            <label>Height (inches)</label>
            <input type="number" min={60} max={84} value={heightInches} onChange={(e) => setHeightInches(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Weight (lbs)</label>
            <input type="number" min={130} max={340} value={weightLbs} onChange={(e) => setWeightLbs(Number(e.target.value))} />
          </div>
        </div>

        <div className="field">
          <label>Personality — pick 1 to 3 traits</label>
          <div className="pill-select">
            {PERSONALITY_OPTIONS.map((trait) => (
              <button key={trait} type="button" className={`pill-option ${personality.includes(trait) ? "selected" : ""}`} onClick={() => togglePersonality(trait)}>
                {PERSONALITY_LABELS[trait]}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn btn-ghost" onClick={() => gameStore.setState({ screen: "career-select" })}>
            Back
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmitBio} onClick={goToAttributes}>
            Next: Build Attributes
          </button>
        </div>
      </div>
    </div>
  );
}
