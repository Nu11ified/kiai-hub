import type { BracketEntry, GeneratedMatch, ByeMethod } from "./types.js";
import { generateRoundRobin } from "./round-robin.js";
import { generateSingleElimination } from "./single-elimination.js";

interface PoolToEliminationOptions {
  poolCount: number;
  advancePerPool: number;
  eliminationByeMethod: ByeMethod;
  thirdPlaceMatch: boolean;
}

export interface PoolToEliminationResult {
  poolMatches: GeneratedMatch[];
  eliminationPlaceholder: {
    entryCount: number;
    byeMethod: ByeMethod;
    thirdPlaceMatch: boolean;
  };
}

/**
 * Generates pool-stage matches for a pool-to-elimination tournament.
 *
 * Pool matches are generated immediately. Elimination bracket is generated
 * later (after pools complete) via generateEliminationFromPools(), because
 * we need pool results to determine who advances.
 */
export function generatePoolStage(
  entries: BracketEntry[],
  options: PoolToEliminationOptions
): PoolToEliminationResult {
  if (entries.length < options.poolCount * 2) {
    throw new Error("Not enough entries for the number of pools");
  }

  const poolMatches = generateRoundRobin(entries, {
    poolCount: options.poolCount,
  });

  return {
    poolMatches,
    eliminationPlaceholder: {
      entryCount: options.poolCount * options.advancePerPool,
      byeMethod: options.eliminationByeMethod,
      thirdPlaceMatch: options.thirdPlaceMatch,
    },
  };
}

/**
 * After pool stage is complete and standings are computed,
 * generate the elimination bracket from pool qualifiers.
 *
 * Entries should be ordered: Pool1 #1, Pool2 #1, ..., PoolN #1,
 * Pool1 #2, Pool2 #2, ..., PoolN #2 — this naturally provides
 * cross-pool seeding (same-pool entries on opposite sides).
 */
export function generateEliminationFromPools(
  advancingEntries: BracketEntry[],
  options: {
    byeMethod: ByeMethod;
    thirdPlaceMatch: boolean;
  }
): GeneratedMatch[] {
  // Assign seed numbers based on entry order
  const seeded = advancingEntries.map((e, i) => ({
    ...e,
    seedNumber: i + 1,
  }));

  return generateSingleElimination(seeded, {
    byeMethod: options.byeMethod,
    thirdPlaceMatch: options.thirdPlaceMatch,
  });
}
