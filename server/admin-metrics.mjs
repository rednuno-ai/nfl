const DAY = 86400000;
export function canViewMetrics(username, configuredOwner) {
  return Boolean(configuredOwner && username !== "adm" && username === configuredOwner.trim().toLowerCase());
}

/** Aggregate only: never return identifiers, credentials or saved player data. */
export function aggregateMetrics(accounts, careers, now = Date.now()) {
  const today = Math.floor(now / DAY) * DAY;
  const start = today - 29 * DAY;
  const previous = start - 30 * DAY;
  const realAccounts = accounts.filter(row => row.username !== "adm");
  const owners = new Set(realAccounts.map(row => row.username));
  const daily = Array.from({ length: 30 }, (_, i) => ({ date: new Date(start + i * DAY).toISOString().slice(0, 10), accounts: 0, latestSaves: 0 }));
  let newAccounts = 0, previousAccounts = 0;
  for (const row of realAccounts) {
    const time = Number(row.created_at);
    if (time >= start && time <= now) { newAccounts++; daily[Math.floor((time - start) / DAY)].accounts++; }
    else if (time >= previous && time < start) previousAccounts++;
  }
  const active = new Set(), stages = {}, positions = {};
  let savedCareers = 0, games = 0, invalidSaves = 0;
  for (const row of careers) {
    if (!owners.has(row.user_id)) continue;
    const updated = Number(row.updated_at);
    if (updated >= start && updated <= now) { active.add(row.user_id); daily[Math.floor((updated - start) / DAY)].latestSaves++; }
    let state;
    try { state = JSON.parse(row.state_json); } catch { invalidSaves++; continue; }
    if (!state?.player || !Array.isArray(state.currentSeasonGameStats) || !Array.isArray(state.statHistory)) { invalidSaves++; continue; }
    savedCareers++;
    const stage = ["high_school", "recruiting", "college", "draft", "nfl_season", "nfl_offseason", "free_agency", "retired"].includes(state.stage) ? state.stage : "unknown";
    const position = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"].includes(state.player.position) ? state.player.position : "unknown";
    stages[stage] = (stages[stage] ?? 0) + 1;
    positions[position] = (positions[position] ?? 0) + 1;
    games += state.currentSeasonGameStats.length + state.statHistory.reduce((sum, line) => sum + (Number.isFinite(line?.gamesPlayed) ? Math.max(0, line.gamesPlayed) : 0), 0);
  }
  return { generatedAt: new Date(now).toISOString(), periodStart: new Date(start).toISOString(), totalAccounts: realAccounts.length, newAccounts, previousAccounts, activeAccounts: active.size, savedCareers, games, invalidSaves, daily, stages, positions };
}
