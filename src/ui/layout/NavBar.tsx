import type { ScreenId } from "@store/gameStore";

interface NavEntry {
  id: ScreenId;
  label: string;
  icon: string;
}

export const NAV_ENTRIES: NavEntry[] = [
  { id: "dashboard", label: "Home", icon: "🏈" },
  { id: "team", label: "Team", icon: "🛡" },
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "finance", label: "Finance", icon: "💰" },
  { id: "relationships", label: "People", icon: "🤝" },
  { id: "news", label: "News", icon: "📰" },
  { id: "legacy", label: "Legacy", icon: "🏆" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ active, onNavigate, onExit }: { active: ScreenId; onNavigate: (id: ScreenId) => void; onExit: () => void }) {
  return (
    <nav className="app-sidebar">
      <div className="brand">
        <span className="brand-mark">NL</span>
        NFL LIFE
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
        Switch career
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
