import { useGameStore, gameStore } from "@store/gameStore";

const TONE_BADGE: Record<string, string> = {
  positive: "badge-green",
  negative: "badge-red",
  controversial: "badge-gold",
  neutral: "",
};

const TONE_ICON: Record<string, string> = {
  positive: "📈",
  negative: "📉",
  controversial: "🔥",
  neutral: "📰",
};

const TONE_LABEL: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  controversial: "Controversial",
  neutral: "Neutral",
};

export function NewsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;

  return (
    <div>
      <div className="screen-eyebrow">📰 NEWS</div>
      <h1 className="page-title">News &amp; Media</h1>

      <div className="news-hero-art" aria-label="Original career editorial artwork">
        <div className="news-hero-art-copy">
          <span>THE STORY SO FAR</span>
          <strong>OWN THE STORY.</strong>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="section-title">Press</div>
          <div className="list">
            {state.news.map((n) => (
              <div className="list-item news-item" key={n.id} style={{ display: "block" }}>
                <div className="news-headline">
                  <span style={{ marginRight: 8 }}>{TONE_ICON[n.tone] ?? "📰"}</span>
                  {n.headline}
                </div>
                <div className="news-meta">
                  {n.source} · Week {n.week} · <span className={`badge ${TONE_BADGE[n.tone]}`}>{TONE_LABEL[n.tone] ?? n.tone}</span>
                </div>
                <div className="news-body">{n.body}</div>
                {n.requiresResponse && !n.responded && (
                  <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => gameStore.getState().respondNews(n.id)}>
                    Issue a response
                  </button>
                )}
              </div>
            ))}
            {state.news.length === 0 && <p className="faint">📰 No coverage yet — keep playing to build a story.</p>}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Social Media</div>
          <div className="list">
            {state.socialFeed.map((post) => (
              <div className="list-item" key={post.id} style={{ display: "block" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{post.handle}</div>
                <div className="news-body" style={{ margin: "4px 0 8px" }}>
                  {post.body}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  ❤ {post.likes.toLocaleString()} · {post.comments.length} comments
                </div>
              </div>
            ))}
            {state.socialFeed.length === 0 && <p className="faint">💬 Nothing trending yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
