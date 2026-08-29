import { useGameStore, gameStore } from "@store/gameStore";
import { ASSET_ICON, ASSET_LABEL, HOME_CATALOG, OFF_FIELD_ASSETS, VEHICLE_CATALOG, type LifeAssetForSale } from "../lifeCatalog";
import { money, moneyCompact } from "../format";

function ShopRow({ asset, cash }: { asset: LifeAssetForSale; cash: number }) {
  const affordable = cash >= asset.value;
  return (
    <div className="life-shop-row">
      <div className="life-shop-icon" aria-hidden="true">{ASSET_ICON[asset.type]}</div>
      <div className="life-shop-info">
        <div className="life-shop-topline"><span className="life-shop-tier">{asset.tier}</span><strong>{asset.name}</strong></div>
        <div className="life-shop-tagline">{asset.tagline}</div>
        <div className="life-shop-upkeep">{money(asset.value)} · {asset.weeklyUpkeep ? `${money(asset.weeklyUpkeep)}/wk upkeep` : `${money(asset.weeklyReturn)}/wk return`}</div>
      </div>
      <button
        className="btn btn-sm life-buy-button"
        disabled={!affordable}
        title={affordable ? `Buy ${asset.name}` : `Need ${money(asset.value - cash)} more`}
        onClick={() => gameStore.getState().purchaseAsset(asset)}
      >
        {affordable ? "Buy" : "Locked"}
      </button>
    </div>
  );
}

export function FinanceScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const f = state.finance;

  return (
    <div className="finance-screen">
      <div className="life-finance-hero">
        <div className="life-finance-hero-art" aria-hidden="true" />
        <div className="life-finance-hero-copy">
          <div className="screen-eyebrow">OFF-FIELD EMPIRE</div>
          <h1 className="page-title">Your Lifestyle</h1>
          <p className="page-subtitle">Spend smart.</p>
        </div>
        <div className="life-finance-hero-chip">{moneyCompact(f.netWorth)} net worth</div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="stat-tile"><div className="value">{moneyCompact(f.cash)}</div><div className="label">Available Cash</div>{f.debt > 0 && <div className="faint life-debt">{moneyCompact(f.debt)} debt</div>}</div>
        <div className="stat-tile"><div className="value">{moneyCompact(f.netWorth)}</div><div className="label">Net Worth</div></div>
        <div className="stat-tile"><div className="value">{moneyCompact(f.totalCareerEarnings)}</div><div className="label">Career Earnings</div></div>
        <div className="stat-tile"><div className="value">{f.sponsorships.length}/50</div><div className="label">Active Partners</div></div>
      </div>

      <div className="life-market-grid">
        <section className="card life-market-card life-market-card--garage">
          <div className="life-card-heading"><div><div className="life-card-kicker">THE SHOWROOM</div><div className="section-title">Build your garage</div></div><span className="life-card-count">{f.assets.filter((a) => a.type === "car").length} owned</span></div>
          <div className="life-shop-list">{VEHICLE_CATALOG.map((asset) => <ShopRow asset={asset} cash={f.cash} key={asset.name} />)}</div>
        </section>

        <section className="card life-market-card life-market-card--home">
          <div className="life-card-heading"><div><div className="life-card-kicker">THE PROPERTY DESK</div><div className="section-title">Choose your home base</div></div><span className="life-card-count">{f.assets.filter((a) => a.type === "house").length} owned</span></div>
          <div className="life-shop-list">{HOME_CATALOG.map((asset) => <ShopRow asset={asset} cash={f.cash} key={asset.name} />)}</div>
        </section>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 18 }}>
        <section className="card">
          <div className="life-card-heading"><div><div className="life-card-kicker">OWNED</div><div className="section-title">Your portfolio</div></div></div>
          {f.assets.length === 0 && <p className="faint">No assets yet.</p>}
          <div className="list">
            {f.assets.map((asset) => (
              <div className="list-item" key={asset.id}>
                <div className="life-owned-item"><span className="life-owned-icon">{ASSET_ICON[asset.type] ?? "◇"}</span><div><strong>{asset.name}</strong><div className="faint">{money(asset.value)} · {asset.weeklyUpkeep ? `${money(asset.weeklyUpkeep)}/wk upkeep` : `${money(asset.weeklyReturn)}/wk return`}</div></div></div>
                <span className="badge">{ASSET_LABEL[asset.type] ?? asset.type}</span>
              </div>
            ))}
          </div>
          <div className="life-small-section-title">Other opportunities</div>
          <div className="life-shop-list">{OFF_FIELD_ASSETS.map((asset) => <ShopRow asset={asset} cash={f.cash} key={asset.name} />)}</div>
        </section>

        <section className="card life-sponsor-card">
          <div className="life-card-heading"><div><div className="life-card-kicker">COMMERCIAL DESK</div><div className="section-title">Sponsorships</div></div><span className="life-card-count">{f.sponsorships.length} / 50</span></div>
          {f.sponsorships.length === 0 && <p className="faint">No active partners.</p>}
          <div className="list">
            {f.sponsorships.map((s) => (
              <div className="list-item" key={s.id}>
                <div className="life-owned-item"><span className="life-owned-icon">✦</span><div><strong>{s.brand}</strong><div className="faint">{s.weeksRemaining} week(s) remaining</div></div></div>
                <span className="badge badge-green">{money(s.weeklyValue)}/wk</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
