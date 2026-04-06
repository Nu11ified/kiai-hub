import type { GeneratedMatch, CourtAssignment } from "./types.js";

/**
 * Distributes matches across courts evenly.
 *
 * Strategy:
 * - Round 1 matches distributed round-robin across courts
 * - Later rounds try to keep winners on the same court
 *   (minimize transitions between shiaijo)
 */
export function assignMatchesToCourts(
  matches: GeneratedMatch[],
  courtCount: number
): CourtAssignment[] {
  if (courtCount < 1) throw new Error("Need at least 1 court");
  if (courtCount === 1) {
    return matches
      .filter((m) => !m.isBye)
      .map((m) => ({ matchId: m.id, courtNumber: 1 }));
  }

  const assignments: CourtAssignment[] = [];

  // Group matches by round
  const byRound = new Map<number, GeneratedMatch[]>();
  for (const m of matches) {
    if (m.isBye) continue;
    const round = byRound.get(m.roundNumber) ?? [];
    round.push(m);
    byRound.set(m.roundNumber, round);
  }

  // Track which court each match is on (for winner continuity)
  const matchCourt = new Map<string, number>();

  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  for (const round of rounds) {
    const roundMatches = byRound.get(round)!;
    let courtIdx = 0;

    for (const match of roundMatches) {
      let assignedCourt: number | null = null;

      // For later rounds, try to inherit court from feeder match
      if (round > 1) {
        const feeders = matches.filter((m) => m.nextMatchId === match.id);
        const feederCourts = feeders
          .map((f) => matchCourt.get(f.id))
          .filter((c): c is number => c !== undefined);

        if (feederCourts.length > 0) {
          assignedCourt = feederCourts[0];
        }
      }

      if (assignedCourt === null) {
        assignedCourt = (courtIdx % courtCount) + 1;
        courtIdx++;
      }

      matchCourt.set(match.id, assignedCourt);
      assignments.push({
        matchId: match.id,
        courtNumber: assignedCourt,
      });
    }
  }

  return assignments;
}
