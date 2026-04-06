import type { BracketEntry, GeneratedMatch, KachinukiBout } from "./types.js";

const POSITION_NAMES = ["senpo", "jiho", "chuken", "fukusho", "taisho"] as const;

export interface TeamLineup {
  entryId: string;
  fighters: Array<{
    registrationId: string;
    position: (typeof POSITION_NAMES)[number];
    sortOrder: number;
  }>;
}

interface KachinukiOptions {
  carryOverIppon: boolean;
  teamSize: number;
}

/**
 * Generates the initial bout for a kachinuki match between two teams.
 *
 * In kachinuki (勝ち抜き), only the first bout is pre-determined (senpo vs senpo).
 * Subsequent bouts are determined dynamically:
 * - Winner stays on court
 * - Next fighter from losing team enters
 * - Continue until one team has no fighters left
 *
 * The API layer handles bout progression; this function creates the
 * initial match structure.
 */
export function generateKachinukiFirstBout(
  team1: TeamLineup,
  team2: TeamLineup
): GeneratedMatch {
  if (team1.fighters.length === 0 || team2.fighters.length === 0) {
    throw new Error("Both teams must have at least one fighter");
  }

  return {
    id: crypto.randomUUID(),
    roundNumber: 1,
    matchNumber: 1,
    player1EntryId: team1.entryId,
    player2EntryId: team2.entryId,
    nextMatchId: null,
    nextMatchSlot: null,
    isBye: false,
    isThirdPlace: false,
  };
}

/**
 * Given the result of a kachinuki bout, determines the next bout.
 *
 * @returns next bout info, or null if the match is over (losing team has no fighters left)
 */
export function getNextKachinukiBout(
  winnerTeam: TeamLineup,
  loserTeam: TeamLineup,
  currentWinnerFighterIdx: number,
  currentLoserFighterIdx: number,
  boutNumber: number
): KachinukiBout | null {
  const nextLoserFighterIdx = currentLoserFighterIdx + 1;

  if (nextLoserFighterIdx >= loserTeam.fighters.length) {
    return null;
  }

  const nextLoserFighter = loserTeam.fighters[nextLoserFighterIdx];
  const currentWinnerFighter = winnerTeam.fighters[currentWinnerFighterIdx];

  return {
    id: crypto.randomUUID(),
    matchNumber: boutNumber + 1,
    team1EntryId: winnerTeam.entryId,
    team2EntryId: loserTeam.entryId,
    team1FighterId: currentWinnerFighter.registrationId,
    team2FighterId: nextLoserFighter.registrationId,
    team1Position:
      POSITION_NAMES[currentWinnerFighterIdx] ??
      `fighter_${currentWinnerFighterIdx + 1}`,
    team2Position:
      POSITION_NAMES[nextLoserFighterIdx] ??
      `fighter_${nextLoserFighterIdx + 1}`,
  };
}

/**
 * Generates a kachinuki tournament bracket for multiple teams.
 * Teams are paired in single-elimination format, but each "match" is
 * a kachinuki series between two teams.
 */
export function generateKachinukiBracket(
  teamEntries: BracketEntry[],
  _options: KachinukiOptions
): GeneratedMatch[] {
  const n = teamEntries.length;
  if (n < 2) throw new Error("Need at least 2 teams");

  const bracketSize = nextPowerOf2(n);
  const totalRounds = Math.log2(bracketSize);
  const matches: GeneratedMatch[] = [];

  // Pre-generate match IDs
  const matchIdGrid: string[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    matchIdGrid.push(
      Array.from({ length: matchesInRound }, () => crypto.randomUUID())
    );
  }

  let matchCounter = 0;
  let entryIdx = 0;

  // Round 1
  const round1Count = bracketSize / 2;
  for (let i = 0; i < round1Count; i++) {
    const p1 = entryIdx < n ? teamEntries[entryIdx].id : null;
    entryIdx++;
    const p2 = entryIdx < n ? teamEntries[entryIdx].id : null;
    entryIdx++;

    const isBye = p1 === null || p2 === null;
    const nextRoundIdx = Math.floor(i / 2);
    const nextMatchId = totalRounds > 1 ? matchIdGrid[1][nextRoundIdx] : null;

    matchCounter++;
    matches.push({
      id: matchIdGrid[0][i],
      roundNumber: 1,
      matchNumber: matchCounter,
      player1EntryId: p1,
      player2EntryId: p2,
      nextMatchId,
      nextMatchSlot: nextMatchId
        ? (i % 2 === 0 ? "player1" : "player2")
        : null,
      isBye,
      isThirdPlace: false,
    });
  }

  // Later rounds
  for (let round = 2; round <= totalRounds; round++) {
    const count = bracketSize / Math.pow(2, round);
    for (let i = 0; i < count; i++) {
      const isLast = round === totalRounds;
      const nextIdx = Math.floor(i / 2);
      const nextMatchId = isLast ? null : matchIdGrid[round][nextIdx];

      matchCounter++;
      matches.push({
        id: matchIdGrid[round - 1][i],
        roundNumber: round,
        matchNumber: matchCounter,
        player1EntryId: null,
        player2EntryId: null,
        nextMatchId,
        nextMatchSlot: isLast
          ? null
          : (i % 2 === 0 ? "player1" : "player2"),
        isBye: false,
        isThirdPlace: false,
      });
    }
  }

  return matches;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export { POSITION_NAMES };
