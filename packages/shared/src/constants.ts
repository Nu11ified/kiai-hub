export const KENDO_RANKS = [
  "unranked",
  "6-kyu",
  "5-kyu",
  "4-kyu",
  "3-kyu",
  "2-kyu",
  "1-kyu",
  "1-dan",
  "2-dan",
  "3-dan",
  "4-dan",
  "5-dan",
  "6-dan",
  "7-dan",
  "8-dan",
] as const;

export const FEDERATIONS = [
  "AUSKF",
  "FIK",
  "BKA",
  "AKR",
  "CKF",
  "EKF",
  "ZNKR",
  "Other",
] as const;

export const EVENT_TYPES = [
  "taikai",
  "seminar",
  "shinsa",
  "gasshuku",
  "practice",
  "other",
] as const;

export const EVENT_STATUSES = [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const BRACKET_FORMATS = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "kachinuki",
  "pool_to_elimination",
] as const;

export const DOJO_ROLES = ["owner", "admin", "volunteer"] as const;

export const POINT_TYPES = ["men", "kote", "do", "tsuki", "hansoku"] as const;

export const CURRENCIES = ["USD", "JPY", "EUR", "GBP", "CAD", "AUD"] as const;

export const PLATFORM_FEE_PERCENT = 2;

/** Returns the numeric index of a rank for comparison. Higher = more senior. */
export function rankToIndex(rank: string): number {
  const idx = KENDO_RANKS.indexOf(rank as KendoRank);
  return idx === -1 ? 0 : idx;
}

export type KendoRank = (typeof KENDO_RANKS)[number];
export type Federation = (typeof FEDERATIONS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type BracketFormat = (typeof BRACKET_FORMATS)[number];
export type DojoRole = (typeof DOJO_ROLES)[number];
export type PointType = (typeof POINT_TYPES)[number];
export type Currency = (typeof CURRENCIES)[number];
