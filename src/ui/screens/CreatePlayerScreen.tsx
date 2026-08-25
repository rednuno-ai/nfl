import { useState } from "react";
import { gameStore } from "@store/gameStore";
import { MVP_POSITIONS, type Hand, type PersonalityTrait, type Position } from "@engine/types";
import { PERSONALITY_LABELS } from "@engine/player";

const PERSONALITY_OPTIONS = Object.keys(PERSONALITY_LABELS) as PersonalityTrait[];
const US_STATES = ["TX", "CA", "FL", "OH", "GA", "PA", "NC", "MI", "LA", "AL", "TN", "AZ", "NY", "IL", "VA"];

export function CreatePlayerScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("TX");
  const [hand, setHand] = useState<Hand>("right");
  const [heightInches, setHeightInches] = useState(72);
  const [weightLbs, setWeightLbs] = useState(200);
  const [personality, setPersonality] = useState<PersonalityTrait[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && city.trim().length > 0 && personality.length > 0 && personality.length <= 3;

  function togglePersonality(trait: PersonalityTrait) {
    setPersonality((prev) => (prev.includes(trait) ? prev.filter((t) => t !== trait) : prev.length < 3 ? [...prev, trait] : prev));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
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
    });
    setSubmitting(false);
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
              <button key={p} className={`pill-option ${position === p ? "selected" : ""}`} onClick={() => setPosition(p)} type="button">
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
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? "Starting…" : "Start Career"}
          </button>
        </div>
      </div>
    </div>
  );
}
