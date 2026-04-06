import type { BracketEntry, SeedMethod } from "./types.js";
import { rankToIndex } from "../constants.js";

export function seedEntries(
  entries: BracketEntry[],
  method: SeedMethod
): BracketEntry[] {
  const copy = [...entries];

  switch (method) {
    case "random":
      return shuffleArray(copy).map((e, i) => ({
        ...e,
        seedNumber: i + 1,
      }));

    case "by_rank":
      return copy
        .sort((a, b) => {
          const rankA = a.rank ? rankToIndex(a.rank) : 0;
          const rankB = b.rank ? rankToIndex(b.rank) : 0;
          return rankB - rankA;
        })
        .map((e, i) => ({ ...e, seedNumber: i + 1 }));

    case "by_region":
      return seedByRegion(copy);

    case "manual":
      return copy;
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function seedByRegion(entries: BracketEntry[]): BracketEntry[] {
  const byRegion = new Map<string, BracketEntry[]>();
  const noRegion: BracketEntry[] = [];

  for (const entry of entries) {
    if (entry.region) {
      const group = byRegion.get(entry.region) ?? [];
      group.push(entry);
      byRegion.set(entry.region, group);
    } else {
      noRegion.push(entry);
    }
  }

  const regionQueues = [...byRegion.values()].map((g) => shuffleArray(g));
  regionQueues.sort((a, b) => b.length - a.length);

  const result: BracketEntry[] = [];
  let queueIndex = 0;

  while (regionQueues.some((q) => q.length > 0) || noRegion.length > 0) {
    let placed = false;
    for (let attempts = 0; attempts < regionQueues.length; attempts++) {
      const idx = (queueIndex + attempts) % regionQueues.length;
      if (regionQueues[idx].length > 0) {
        result.push(regionQueues[idx].shift()!);
        queueIndex = (idx + 1) % regionQueues.length;
        placed = true;
        break;
      }
    }
    if (!placed && noRegion.length > 0) {
      result.push(noRegion.shift()!);
    } else if (!placed) {
      break;
    }
  }

  result.push(...noRegion);

  return result.map((e, i) => ({ ...e, seedNumber: i + 1 }));
}
