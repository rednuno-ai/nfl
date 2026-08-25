export function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}$${abs.toLocaleString()}`;
}

export function moneyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return money(value);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function heightLabel(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

export const STAGE_LABELS: Record<string, string> = {
  high_school: "High School",
  recruiting: "Recruiting",
  college: "College",
  draft: "NFL Draft",
  nfl_offseason: "NFL Offseason",
  nfl_season: "NFL Season",
  free_agency: "Free Agency",
  retired: "Retired",
};
