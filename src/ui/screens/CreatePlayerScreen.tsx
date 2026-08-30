import { useEffect, useState, type ReactNode } from "react";
import { gameStore } from "@store/gameStore";
import { abandonOnboarding, setOnboardingStage } from "@data/metrics";
import { MVP_POSITIONS, type Hand, type PersonalityTrait, type Position } from "@engine/types";
import { PERSONALITY_DESCRIPTIONS, PERSONALITY_LABELS } from "@engine/player";
import { getBuildEffects, pointBuyPointsLeft, POINT_BUY_BASELINE, POINT_BUY_MAX, POINT_BUY_POOL, POINT_BUY_SLOTS, previewPointBuyOverall, recommendedPointBuyAllocations } from "@engine/attributes";
import { PositionBadge } from "@ui/components/PositionBadge";

const PERSONALITY_OPTIONS = Object.keys(PERSONALITY_LABELS) as PersonalityTrait[];
const US_STATES = ["TX", "CA", "FL", "OH", "GA", "PA", "NC", "MI", "LA", "AL", "TN", "AZ", "NY", "IL", "VA"];

// Full name + one-line flavor for each playable "class" — the character
// creator's position picker used to be a row of plain text pills; this is
// what turns it into something that reads like choosing a class in an RPG.
const POSITION_FULL_NAME: Record<string, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  LB: "Linebacker",
  CB: "Cornerback",
};

const POSITION_IMPACT: Record<Position, string> = {
  QB: "Accuracy, awareness, decision-making, pressure and agility drive your rating.",
  RB: "Vision, elusiveness, breaking tackles, speed and acceleration drive your rating.",
  WR: "Catching, routes, speed, release and agility drive your rating.",
  TE: "Catching, routes, blocking, strength and speed drive your rating.",
  LB: "Tackling, pursuit, shedding blocks, coverage, strength and football IQ drive your rating.",
  CB: "Coverage, press, ball skills, speed and agility drive your rating.",
  OL: "Blocking, technique and strength drive your rating.",
  DL: "Tackling, block shedding, technique and strength drive your rating.",
  S: "Tackling, coverage, technique and football IQ drive your rating.",
  K: "Technique and special-teams skill drive your rating.",
  P: "Technique and special-teams skill drive your rating.",
};

const PERSONALITY_ICON: Record<PersonalityTrait, string> = {
  ambitious: "🎯",
  loyal: "🤝",
  disciplined: "🧠",
  charismatic: "🎤",
  aggressive: "🔥",
  introvert: "🧘",
  risk_taker: "😈",
  family_oriented: "👨‍👩‍👧",
  materialistic: "💰",
  competitive: "💪",
};

function PlayerCreationFrame({ children }: { children: ReactNode }) {
  return (
    <div className="player-creation-page">
      <header className="player-creation-header">
        <span className="player-creation-brand">GRIDIRON LIFE</span>
      </header>
      <main className="centered-page" id="create-player-main">
        {children}
      </main>
      <footer className="player-creation-footer">Build your way.</footer>
    </div>
  );
}

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
  const pointsLeft = pointBuyPointsLeft(position, allocations);
  const previewOverall = previewPointBuyOverall(position, allocations, { heightInches, weightLbs });
  const buildEffects = getBuildEffects(heightInches, weightLbs);

  useEffect(() => {
    setOnboardingStage(step);
  }, [step]);

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
    if (!canSubmitBio || pointsLeft !== 0) return;
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
      <PlayerCreationFrame>
        <div className="onboarding-card card">
          <h1 className="page-title">Build Your Player</h1>
          <p className="page-subtitle">Spend {POINT_BUY_POOL} points on your {position} strengths.</p>

          <div className="ovr-preview-card" aria-live="polite" aria-atomic="true">
            <div className="ovr-preview-label">OVERALL</div>
            <div className="ovr-preview-number">{previewOverall}</div>
            <div className={`points-left ${pointsLeft === 0 ? "points-left-done" : ""}`}>
              {pointsLeft === 0 ? "All points allocated — ready to start." : `${pointsLeft} point${pointsLeft === 1 ? "" : "s"} left to allocate`}
            </div>
          </div>

          <aside className="build-explainer" aria-label="How your overall is calculated">
            <strong>How OVR works</strong>
            <span>{POSITION_IMPACT[position]} Your six selected skills start at {POINT_BUY_BASELINE}; OVR is the position-weighted average of relevant skills after your allocation and body-profile trade-offs. Personality shapes events and does not add hidden OVR.</span>
          </aside>

          <div className="build-actions" role="group" aria-label="Attribute build shortcuts">
            <button type="button" className="btn btn-ghost" onClick={() => setAllocations(recommendedPointBuyAllocations(position))}>Recommended Build</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAllocations({})} disabled={pointsSpent === 0}>Reset allocation</button>
          </div>

          <div className="attribute-list">
            {slots.map((slot) => {
              const value = POINT_BUY_BASELINE + (allocations[slot.path] ?? 0);
              return (
                <div className="attribute-row" key={slot.path}>
                  <div className="attribute-row-label">{slot.label}</div>
                  <button type="button" className="attribute-step" aria-label={`Remove two points from ${slot.label}`} onClick={() => adjustPoint(slot.path, -2)} disabled={(allocations[slot.path] ?? 0) <= 0}>
                    −
                  </button>
                  <div className="attribute-bar-track">
                    <div className="attribute-bar-fill" style={{ width: `${value}%` }} />
                    <span className="attribute-value">{value}</span>
                  </div>
                  <button
                    type="button"
                    className="attribute-step"
                    aria-label={`Add two points to ${slot.label}`}
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
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={submitting || pointsLeft !== 0} onClick={handleSubmit} aria-describedby={pointsLeft !== 0 ? "points-required" : undefined}>
              {submitting ? "Starting…" : "Start Career"}
            </button>
          </div>
          {pointsLeft !== 0 && <p className="form-help form-help-warning" id="points-required">Spend all {pointsLeft} points to continue.</p>}
        </div>
      </PlayerCreationFrame>
    );
  }

  return (
    <PlayerCreationFrame>
      <div className="onboarding-card card">
        <h1 className="page-title">Build Your Player</h1>
        <p className="page-subtitle">Age 15 · Freshman year</p>

        <fieldset className="field build-fieldset">
          <legend>Position</legend>
          <p className="form-help">Position controls which attributes carry the most weight in your overall rating.</p>
          <div className="class-card-grid">
            {MVP_POSITIONS.map((p) => (
              <button key={p} type="button" aria-pressed={position === p} className={`class-card ${position === p ? "selected" : ""}`} onClick={() => setPosition(p)}>
                <PositionBadge position={p} size={40} />
                <div className="class-card-code">{p}</div>
                <div className="class-card-name">{POSITION_FULL_NAME[p] ?? p}</div>
                <span className="sr-only">{POSITION_IMPACT[p]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field build-fieldset">
          <legend>Personality — pick 1 to 3 traits</legend>
          <p className="form-help">Traits influence event opportunities and small starting-talent nudges; they do not directly add to OVR.</p>
          <div className="trait-card-grid">
            {PERSONALITY_OPTIONS.map((trait) => {
              const selected = personality.includes(trait);
              const selectedIndex = personality.indexOf(trait);
              return (
                <button key={trait} type="button" aria-pressed={selected} className={`trait-card ${selected ? "selected" : ""}`} onClick={() => togglePersonality(trait)}>
                  {selected && <div className="trait-card-badge">{selectedIndex + 1}</div>}
                  <div className="trait-card-icon">{PERSONALITY_ICON[trait]}</div>
                  <div className="trait-card-label">{PERSONALITY_LABELS[trait]}</div>
                  <div className="trait-card-desc">{PERSONALITY_DESCRIPTIONS[trait]}</div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="player-first-name">First name</label>
            <input id="player-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" maxLength={24} autoComplete="given-name" />
          </div>
          <div className="field">
            <label htmlFor="player-last-name">Last name</label>
            <input id="player-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Reed" maxLength={24} autoComplete="family-name" />
          </div>
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="player-city">Hometown city</label>
            <input id="player-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ironpoint" maxLength={30} autoComplete="address-level2" />
          </div>
          <div className="field">
            <label htmlFor="player-state">State</label>
            <select id="player-state" value={stateName} onChange={(e) => setStateName(e.target.value)}>
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
            <label htmlFor="player-hand">Dominant hand</label>
            <select id="player-hand" value={hand} onChange={(e) => setHand(e.target.value as Hand)}>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="player-height">Height (inches)</label>
            <input id="player-height" type="number" min={60} max={84} value={heightInches} onChange={(e) => setHeightInches(Number(e.target.value))} aria-describedby="build-body-note" />
          </div>
          <div className="field">
            <label htmlFor="player-weight">Weight (lbs)</label>
            <input id="player-weight" type="number" min={130} max={340} value={weightLbs} onChange={(e) => setWeightLbs(Number(e.target.value))} aria-describedby="build-body-note" />
          </div>
        </div>
        <aside className="build-explainer body-build-explainer" id="build-body-note" aria-label="Height and weight trade-offs">
          <strong>Body profile trade-offs</strong>
          <span><b>{buildEffects.height.title}:</b> {buildEffects.height.benefit} {buildEffects.height.drawback}</span>
          <span><b>{buildEffects.weight.title}:</b> {buildEffects.weight.benefit} {buildEffects.weight.drawback}</span>
          <span>These transparent starting modifiers apply after your point allocation and can affect OVR only when their attributes matter to your position.</span>
        </aside>

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              abandonOnboarding();
              gameStore.setState({ screen: "career-select" });
            }}
          >
            Back
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmitBio} onClick={goToAttributes}>
            Next: Build Attributes
          </button>
        </div>
      </div>
    </PlayerCreationFrame>
  );
}
