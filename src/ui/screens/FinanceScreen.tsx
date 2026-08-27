import { useGameStore, gameStore } from "@store/gameStore";
import { money, moneyCompact } from "../format";

const QUICK_ASSETS = [
  { name: "Starter House", type: "house" as const, value: 250_000, weeklyUpkeep: 120, weeklyReturn: 0 },
  { name: "Luxury Car", type: "car" as const, value: 85_000, weeklyUpkeep: 60, weeklyReturn: 0 },
  { name: "Index Fund Investment", type: "investment" as const, value: 100_000, weeklyUpkeep: 0, weeklyReturn: 180 },
  { name: "Local Restaurant Stake", type: "business" as const, value: 200_000, weeklyUpkeep: 40, weeklyReturn: 320 },
];

const ASSET_ICON: Record<string, string> = {
  house: "🏠",
  car: "🚗",
  investment: "📈",
  business: "🏢",
};

export function FinanceScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const f = state.finance;

  return (
    <div>
      <div className="page-title">Finance</div>
      <p className="page-subtitle">Every dollar, tracked.</p>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="stat-tile">
          <div className="value">{moneyCompact(f.cash)}</div>
          <div className="label">Cash</div>
          {f.debt > 0 && (
            <div className="faint" style={{ color: "var(--danger, #e5484d)", fontSize: 12, marginTop: 2 }}>
              {moneyCompact(f.debt)} debt
            </div>
          )}
        </div>
        <div className="stat-tile">
          <div className="value">{moneyCompact(f.netWorth)}</div>
          <div className="label">Net Worth</div>
        </div>
        <div className="stat-tile">
          <div className="value">{moneyCompact(f.totalCareerEarnings)}</div>
          <div className="label">Career Earnings</div>
        </div>
        <div className="stat-tile">
          <div className="value">{moneyCompact(f.totalTaxesPaid)}</div>
          <div className="label">Taxes Paid</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="section-title">Assets</div>
          {f.assets.length === 0 && <p className="faint">No assets yet.</p>}
          <div className="list">
            {f.assets.map((a) => (
              <div className="list-item" key={a.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{ASSET_ICON[a.type] ?? "💼"}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.name}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {money(a.value)} · upkeep {money(a.weeklyUpkeep)}/wk {a.weeklyReturn > 0 && `· return ${money(a.weeklyReturn)}/wk`}
                    </div>
                  </div>
                </div>
                <span className="badge">{a.type}</span>
              </div>
            ))}
          </div>

          <div className="section-title" style={{ marginTop: 18 }}>
            Buy Something
          </div>
          <div className="list">
            {QUICK_ASSETS.map((asset) => (
              <div className="list-item" key={asset.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{ASSET_ICON[asset.type] ?? "💼"}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{asset.name}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {money(asset.value)}
                    </div>
                  </div>
                </div>
                <button className="btn btn-sm" disabled={f.cash < asset.value} onClick={() => gameStore.getState().purchaseAsset(asset)}>
                  Buy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Sponsorships</div>
          {f.sponsorships.length === 0 && <p className="faint">No active sponsorships. Build your fame to attract offers.</p>}
          <div className="list">
            {f.sponsorships.map((s) => (
              <div className="list-item" key={s.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🤝</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.brand}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {s.weeksRemaining} week(s) remaining
                    </div>
                  </div>
                </div>
                <span className="badge badge-green">{money(s.weeklyValue)}/wk</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
