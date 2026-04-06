import type { ShinpanRotation } from "./types.js";

interface ShinpanInfo {
  index: number;
  name: string;
  userId?: string;
  dojoId?: string;
}

interface RotationOptions {
  shinpanPerCourt: number; // Typically 3 (1 shushin + 2 fukushin)
  rotationInterval: number; // Rotate every N matches
  courtCount: number;
  totalMatches: number;
}

/**
 * Generates shinpan rotation schedule for a tournament.
 *
 * Kendo rules:
 * - Each court has 3 judges: 1 shushin (center) + 2 fukushin (sides)
 * - Judges rotate every N matches to prevent fatigue bias
 * - Judges should not officiate their own dojo's matches
 *   (conflict checking is done at the API layer with participant data)
 */
export function generateShinpanRotation(
  shinpanList: ShinpanInfo[],
  options: RotationOptions
): ShinpanRotation[] {
  const { shinpanPerCourt, rotationInterval, courtCount, totalMatches } =
    options;
  const totalShinpanNeeded = shinpanPerCourt * courtCount;

  if (shinpanList.length < totalShinpanNeeded) {
    throw new Error(
      `Need at least ${totalShinpanNeeded} shinpan for ${courtCount} courts ` +
        `(${shinpanPerCourt} per court), but only have ${shinpanList.length}`
    );
  }

  const rotations: ShinpanRotation[] = [];
  const matchesPerCourt = Math.ceil(totalMatches / courtCount);
  const rotationGroupCount = Math.ceil(matchesPerCourt / rotationInterval);

  for (let group = 0; group < rotationGroupCount; group++) {
    const offset = (group * totalShinpanNeeded) % shinpanList.length;

    for (let court = 1; court <= courtCount; court++) {
      const courtOffset = offset + (court - 1) * shinpanPerCourt;
      const shinpanIndices: number[] = [];

      for (let s = 0; s < shinpanPerCourt; s++) {
        const idx = (courtOffset + s) % shinpanList.length;
        shinpanIndices.push(shinpanList[idx].index);
      }

      const startMatch = group * rotationInterval;
      const endMatch = Math.min(startMatch + rotationInterval, matchesPerCourt);

      for (let m = startMatch; m < endMatch; m++) {
        const globalMatchNumber = (court - 1) * matchesPerCourt + m;
        if (globalMatchNumber >= totalMatches) break;

        rotations.push({
          matchId: "", // Filled by caller with actual match IDs
          courtNumber: court,
          rotationGroup: group,
          shinpanIndices,
        });
      }
    }
  }

  return rotations;
}
