import type { BracketEntry, GeneratedMatch, ByeMethod } from "./types.js";
import { rankToIndex } from "../constants.js";

interface SEOptions {
  byeMethod: ByeMethod;
  thirdPlaceMatch: boolean;
}

export function generateSingleElimination(
  entries: BracketEntry[],
  options: SEOptions
): GeneratedMatch[] {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 entries");

  const bracketSize = nextPowerOf2(n);
  const byeCount = bracketSize - n;
  const totalRounds = Math.log2(bracketSize);

  const byeRecipientSeeds = selectByeRecipients(entries, byeCount, options.byeMethod);
  const slots = buildBracketSlots(entries, bracketSize, byeRecipientSeeds);

  const matches: GeneratedMatch[] = [];
  let matchCounter = 0;

  // Pre-generate match IDs for all rounds (needed for linking)
  const matchIdGrid: string[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const roundIds: string[] = [];
    for (let i = 0; i < matchesInRound; i++) {
      roundIds.push(crypto.randomUUID());
    }
    matchIdGrid.push(roundIds);
  }

  let thirdPlaceMatchId: string | null = null;
  if (options.thirdPlaceMatch && totalRounds >= 2) {
    thirdPlaceMatchId = crypto.randomUUID();
  }

  // Round 1: pair up slots
  const round1MatchCount = bracketSize / 2;
  for (let i = 0; i < round1MatchCount; i++) {
    const p1 = slots[i * 2];
    const p2 = slots[i * 2 + 1];
    const isBye = p1 === null || p2 === null;

    const matchId = matchIdGrid[0][i];
    const nextRoundMatchIndex = Math.floor(i / 2);
    const nextMatchId =
      totalRounds > 1 ? matchIdGrid[1][nextRoundMatchIndex] : null;
    const nextMatchSlot: "player1" | "player2" = i % 2 === 0 ? "player1" : "player2";

    matchCounter++;
    matches.push({
      id: matchId,
      roundNumber: 1,
      matchNumber: matchCounter,
      player1EntryId: p1,
      player2EntryId: p2,
      nextMatchId,
      nextMatchSlot: nextMatchId ? nextMatchSlot : null,
      isBye,
      isThirdPlace: false,
    });
  }

  // Subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let i = 0; i < matchesInRound; i++) {
      const matchId = matchIdGrid[round - 1][i];
      const isLastRound = round === totalRounds;
      const nextRoundMatchIndex = Math.floor(i / 2);
      const nextMatchId = isLastRound
        ? null
        : matchIdGrid[round][nextRoundMatchIndex];
      const nextMatchSlot: "player1" | "player2" = i % 2 === 0 ? "player1" : "player2";

      matchCounter++;
      matches.push({
        id: matchId,
        roundNumber: round,
        matchNumber: matchCounter,
        player1EntryId: null,
        player2EntryId: null,
        nextMatchId: isLastRound ? null : nextMatchId,
        nextMatchSlot: isLastRound ? null : nextMatchSlot,
        isBye: false,
        isThirdPlace: false,
      });
    }
  }

  // Third place match: losers of semi-finals play each other
  if (thirdPlaceMatchId && totalRounds >= 2) {
    matchCounter++;
    matches.push({
      id: thirdPlaceMatchId,
      roundNumber: totalRounds,
      matchNumber: matchCounter,
      player1EntryId: null,
      player2EntryId: null,
      nextMatchId: null,
      nextMatchSlot: null,
      isBye: false,
      isThirdPlace: true,
    });
  }

  return matches;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function selectByeRecipients(
  entries: BracketEntry[],
  byeCount: number,
  method: ByeMethod
): Set<string> {
  if (byeCount === 0) return new Set();

  let sorted: BracketEntry[];

  switch (method) {
    case "by_rank":
      // Higher rank gets byes (reward for experience — kendo convention)
      sorted = [...entries].sort((a, b) => {
        const rankA = a.rank ? rankToIndex(a.rank) : 0;
        const rankB = b.rank ? rankToIndex(b.rank) : 0;
        return rankB - rankA;
      });
      break;

    case "by_age":
      // Older age gets byes (senpai respect)
      sorted = [...entries].sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
      break;

    case "random":
    default: {
      sorted = [...entries];
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      break;
    }
  }

  return new Set(sorted.slice(0, byeCount).map((e) => e.id));
}

function buildBracketSlots(
  entries: BracketEntry[],
  bracketSize: number,
  byeRecipients: Set<string>
): (string | null)[] {
  const positions = generateSeedPositions(bracketSize);
  const byeEntries = entries.filter((e) => byeRecipients.has(e.id));
  const nonByeEntries = entries.filter((e) => !byeRecipients.has(e.id));

  byeEntries.sort((a, b) => (a.seedNumber ?? 999) - (b.seedNumber ?? 999));
  nonByeEntries.sort((a, b) => (a.seedNumber ?? 999) - (b.seedNumber ?? 999));

  const slots: (string | null)[] = new Array(bracketSize).fill(null);

  // Place bye recipients at top seed positions — their opponent slot stays null
  let seedIdx = 0;
  for (const entry of byeEntries) {
    const pos = positions[seedIdx];
    slots[pos] = entry.id;
    seedIdx++;
  }

  // Place non-bye entries in remaining empty positions
  const filledPositions = new Set(byeEntries.map((_, i) => positions[i]));
  const emptyPositions: number[] = [];
  for (let i = 0; i < bracketSize; i++) {
    if (!filledPositions.has(i) && slots[i] === null) {
      emptyPositions.push(i);
    }
  }

  for (let i = 0; i < nonByeEntries.length && i < emptyPositions.length; i++) {
    slots[emptyPositions[i]] = nonByeEntries[i].id;
  }

  return slots;
}

/**
 * Standard tournament seed position placement.
 * Returns array where index = seed-1, value = bracket position.
 * Ensures seed 1 is at top, seed 2 at bottom, preventing
 * top seeds from meeting until the latest possible round.
 */
function generateSeedPositions(size: number): number[] {
  if (size === 1) return [0];
  if (size === 2) return [0, 1];

  const positions: number[] = new Array(size);
  positions[0] = 0;
  positions[1] = size - 1;

  let step = 2;
  while (step < size) {
    const half = size / step;
    for (let i = step; i < step * 2 && i < size; i++) {
      const mirrorOf = i - step;
      positions[i] = 2 * half - 1 - positions[mirrorOf];
    }
    step *= 2;
  }

  return positions;
}
