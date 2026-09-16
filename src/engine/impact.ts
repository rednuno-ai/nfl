import type { CareerState } from "./career";

const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const signed = (value: number) => `${value > 0 ? "+" : ""}${Number(value.toFixed(2))}`;

/** Compare actual post-clamp values, including nested position attributes. */
export function describeImpact(before: CareerState, after: CareerState): string[] {
  const changes: string[] = [];
  function walk(a: unknown, b: unknown, path: string[] = []) {
    if (typeof a === "number" && typeof b === "number") {
      if (Math.abs(b - a) > 0.00001) changes.push(`${path.map(label).join(" / ")} ${signed(b - a)}`);
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of Object.keys(b)) walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [...path, key]);
    }
  }
  walk(before.player.attributes, after.player.attributes);
  for (const person of after.relationships) {
    const old = before.relationships.find(p => p.id === person.id);
    if (!old) changes.push(`${person.name}: relationship established (${person.value}/100)`);
    else if (person.value !== old.value) changes.push(`${person.name} trust ${signed(person.value - old.value)}`);
  }
  const cash = after.finance.cash - before.finance.cash;
  if (cash) changes.push(`Cash ${signed(cash)} dollars`);
  for (const injury of after.injuries) if (!before.injuries.some(old => old.id === injury.id)) changes.push(`Injury: ${injury.type}`);
  for (const flag of after.tags.filter(tag => !before.tags.includes(tag))) changes.push(`Story: ${flag.replace(/[:_]/g, " ")}`);
  for (const flag of before.tags.filter(tag => !after.tags.includes(tag))) changes.push(`Resolved: ${flag.replace(/[:_]/g, " ")}`);
  return changes;
}
