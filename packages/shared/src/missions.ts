/**
 * Board order for missions: points ascending, then challenge id (natural order,
 * so web2 comes before web10). The challenge id is the identity; the visible
 * "MISSION 01..15" number is only the position in this order and is never stored.
 */
export function compareMissions(a: { id: string; points: number }, b: { id: string; points: number }): number {
  if (a.points !== b.points) return a.points - b.points;
  return a.id.localeCompare(b.id, 'en', { numeric: true });
}

/** Display numbers (1-based) for a set of missions, derived from {@link compareMissions}. */
export function missionNumbers(missions: ReadonlyArray<{ id: string; points: number }>): Map<string, number> {
  return new Map([...missions].sort(compareMissions).map((m, i) => [m.id, i + 1]));
}
