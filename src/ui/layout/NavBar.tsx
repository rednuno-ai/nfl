import type { ScreenId } from "@store/gameStore";

interface NavEntry {
  id: ScreenId;
  label: string;
  icon: string;
}

// Reframed as "departments" of the player's world rather than app menu items
// — same screens, same routing (ScreenId is untouched), just a label/icon
// pass so the sidebar reads like an organization instead of a settings menu.
export const NAV_ENTRIES: NavEntry[] = [
  { id: "dashboard", label: "Home", icon: "🏠" },
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "team", label: "Stadium", icon: "🏟️" },
  { id: "finance", label: "Front Office", icon: "💼" },
  { id: "relationships", label: "People", icon: "🤝" },
  { id: "news", label: "News", icon: "📰" },
  { id: "legacy", label: "Legacy", icon: "🏆" },
  { id: "settings", label: "Profile", icon: "👤" },
];

export function Sidebar({ active, onNavigate, onExit }: { active: ScreenId; onNavigate: (id: ScreenId) => void; onExit: () => void }) {
  return (
    <nav className="app-sidebar">
      <div className="brand">
        <span className="brand-mark">GL</span>
        GRIDIRON LIFE
      </div>
      {NAV_ENTRIES.map((entry) => (
        <button key={entry.id} className={`nav-item ${active === entry.id ? "active" : ""}`} onClick={() => onNavigate(entry.id)}>
          <span className="icon">{entry.icon}</span>
          {entry.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button className="nav-item" onClick={onExit}>
        <span className="icon">⏏</span>
        Switch Career
      </button>
    </nav>
  );
}

export function MobileNav({ active, onNavigate }: { active: ScreenId; onNavigate: (id: ScreenId) => void }) {
  const entries = NAV_ENTRIES.slice(0, 5);
  return (
    <nav className="mobile-nav">
      {entries.map((entry) => (
        <button key={entry.id} className={`mobile-nav-item ${active === entry.id ? "active" : ""}`} onClick={() => onNavigate(entry.id)}>
          <span className="icon">{entry.icon}</span>
          {entry.label}
        </button>
      ))}
    </nav>
  );
}
