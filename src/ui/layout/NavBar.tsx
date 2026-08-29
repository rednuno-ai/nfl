import { useEffect, useRef, useState } from "react";
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
  const entries = NAV_ENTRIES.slice(0, 4);
  const secondary = NAV_ENTRIES.slice(4);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <nav className="mobile-nav" ref={navRef} aria-label="Career navigation">
      {open && <div className="mobile-nav-more" role="menu">
        {secondary.map((entry) => <button key={entry.id} role="menuitem" className={active === entry.id ? "active" : ""} onClick={() => { onNavigate(entry.id); setOpen(false); }}><span aria-hidden="true">{entry.icon}</span>{entry.label}</button>)}
      </div>}
      {entries.map((entry) => (
        <button key={entry.id} aria-current={active === entry.id ? "page" : undefined} className={`mobile-nav-item ${active === entry.id ? "active" : ""}`} onClick={() => onNavigate(entry.id)}>
          <span className="icon" aria-hidden="true">{entry.icon}</span>
          {entry.label}
        </button>
      ))}
      <button className={`mobile-nav-item ${secondary.some((entry) => entry.id === active) ? "active" : ""}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><span className="icon" aria-hidden="true">•••</span>More</button>
    </nav>
  );
}
