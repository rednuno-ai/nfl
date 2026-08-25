export function AttributeBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="attr-row">
      <div className="attr-label">{label}</div>
      <div className="attr-bar-track">
        <div className="attr-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="attr-value">{Math.round(value)}</div>
    </div>
  );
}
