import type { BracketEntry, GeneratedMatch, RoundRobinStanding } from "./types.js";

interface RROptions {
  poolCount?: number;
}

/**
 * Generates all pairings for a round robin tournament.
 * If poolCount > 1, entries are split into pools via snake draft by seed.
 */
export function generateRoundRobin(
  entries: BracketEntry[],
  options: RROptions = {}
): GeneratedMatch[] {
  const poolCount = options.poolCount ?? 1;

  if (entries.length < 2) throw new Error("Need at least 2 entries");

  if (poolCount <= 1) {
    return generatePoolMatches(entries, 1);
  }

  const pools = distributeIntoPools(entries, poolCount);
  const allMatches: GeneratedMatch[] = [];

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const poolMatches = generatePoolMatches(pools[poolIdx], poolIdx + 1);
    allMatches.push(...poolMatches);
  }

  return allMatches;
}

/**
 * Snake draft distribution into pools for balanced seeding.
 * Seed 1 → Pool A, Seed 2 → Pool B, ..., Seed N → Pool N,
 * Seed N+1 → Pool N, Seed N+2 → Pool N-1, ... (snake back)
 */
function distributeIntoPools(
  entries: BracketEntry[],
  poolCount: number
): BracketEntry[][] {
  const pools: BracketEntry[][] = Array.from({ length: poolCount }, () => []);

  const sorted = [...entries].sort(
    (a, b) => (a.seedNumber ?? 999) - (b.seedNumber ?? 999)
  );

  let poolIdx = 0;
  let direction = 1;

  for (const entry of sorted) {
    pools[poolIdx].push(entry);

    if (direction === 1 && poolIdx === poolCount - 1) {
      direction = -1;
    } else if (direction === -1 && poolIdx === 0) {
      direction = 1;
    } else {
      poolIdx += direction;
    }
  }

  return pools;
}

/**
 * Generates all-play-all pairings for a single pool.
 * Uses round-robin scheduling to assign round numbers
 * so each entry plays at most once per round.
 */
function generatePoolMatches(
  entries: BracketEntry[],
  poolNumber: number
): GeneratedMatch[] {
  const n = entries.length;
  const matches: GeneratedMatch[] = [];
  let matchCounter = 0;

  // Circle method for round-robin scheduling
  // If odd entries, add a phantom so everyone gets a bye round
  const list = [...entries.map((e) => e.id)];
  const hasPhantom = n % 2 !== 0;
  if (hasPhantom) {
    list.push("__phantom__");
  }

  const total = list.length;
  const rounds = total - 1;
  const half = total / 2;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const homeIdx = i === 0 ? 0 : ((round + i - 1) % (total - 1)) + 1;
      const awayIdx = i === 0 ? ((round) % (total - 1)) + 1 : ((round - i + total - 1) % (total - 1)) + 1;

      const home = list[homeIdx];
      const away = list[awayIdx];

      // Skip matches involving the phantom entry
      if (home === "__phantom__" || away === "__phantom__") continue;

      matchCounter++;
      matches.push({
        id: crypto.randomUUID(),
        roundNumber: round + 1,
        matchNumber: matchCounter,
        player1EntryId: home,
        player2EntryId: away,
        nextMatchId: null,
        nextMatchSlot: null,
        isBye: false,
        isThirdPlace: false,
        poolNumber,
      });
    }
  }

  return matches;
}

/**
 * Computes round robin standings from completed match data.
 *
 * Kendo FIK tiebreak order:
 * 1. Wins (most)
 * 2. Ippon differential (ipponFor - ipponAgainst)
 * 3. Head-to-head result between tied entries
 * 4. Hantei wins (judge decisions)
 */
export function computeStandingsFromMatches(
  entryIds: string[],
  matchData: Array<{
    player1EntryId: string;
    player2EntryId: string;
    winnerEntryId: string | null;
    winMethod: string | null;
    player1Ippon: number;
    player2Ippon: number;
  }>,
  poolNumber?: number
): RoundRobinStanding[] {
  const standings = new Map<string, RoundRobinStanding>();
  const h2h = new Map<string, Map<string, number>>();

  for (const id of entryIds) {
    standings.set(id, {
      entryId: id,
      wins: 0,
      losses: 0,
      draws: 0,
      ipponFor: 0,
      ipponAgainst: 0,
      ipponDiff: 0,
      hanteiWins: 0,
      rank: 0,
      poolNumber,
    });
  }

  for (const m of matchData) {
    const s1 = standings.get(m.player1EntryId);
    const s2 = standings.get(m.player2EntryId);
    if (!s1 || !s2) continue;

    s1.ipponFor += m.player1Ippon;
    s1.ipponAgainst += m.player2Ippon;
    s2.ipponFor += m.player2Ippon;
    s2.ipponAgainst += m.player1Ippon;

    if (m.winnerEntryId === m.player1EntryId) {
      s1.wins++;
      s2.losses++;
      if (m.winMethod === "hantei") s1.hanteiWins++;
      setH2H(h2h, m.player1EntryId, m.player2EntryId, 1);
      setH2H(h2h, m.player2EntryId, m.player1EntryId, -1);
    } else if (m.winnerEntryId === m.player2EntryId) {
      s2.wins++;
      s1.losses++;
      if (m.winMethod === "hantei") s2.hanteiWins++;
      setH2H(h2h, m.player2EntryId, m.player1EntryId, 1);
      setH2H(h2h, m.player1EntryId, m.player2EntryId, -1);
    } else {
      s1.draws++;
      s2.draws++;
      setH2H(h2h, m.player1EntryId, m.player2EntryId, 0);
      setH2H(h2h, m.player2EntryId, m.player1EntryId, 0);
    }
  }

  for (const s of standings.values()) {
    s.ipponDiff = s.ipponFor - s.ipponAgainst;
  }

  const sorted = [...standings.values()].sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.ipponDiff !== b.ipponDiff) return b.ipponDiff - a.ipponDiff;
    const h2hResult = getH2H(h2h, a.entryId, b.entryId);
    if (h2hResult !== 0) return -h2hResult;
    return b.hanteiWins - a.hanteiWins;
  });

  sorted.forEach((s, i) => {
    s.rank = i + 1;
  });

  return sorted;
}

function setH2H(
  h2h: Map<string, Map<string, number>>,
  a: string,
  b: string,
  result: number
): void {
  if (!h2h.has(a)) h2h.set(a, new Map());
  h2h.get(a)!.set(b, result);
}

function getH2H(
  h2h: Map<string, Map<string, number>>,
  a: string,
  b: string
): number {
  return h2h.get(a)?.get(b) ?? 0;
}
