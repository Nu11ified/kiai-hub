import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { events } from "./events.js";
import { registrations, teams } from "./registrations.js";

export const bracketTypeEnum = pgEnum("bracket_type", [
  "individual",
  "team",
]);

export const bracketFormatEnum = pgEnum("bracket_format", [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "kachinuki",
  "pool_to_elimination",
]);

export const bracketGenderEnum = pgEnum("bracket_gender", [
  "any",
  "male",
  "female",
]);

export const bracketStatusEnum = pgEnum("bracket_status", [
  "setup",
  "seeded",
  "in_progress",
  "completed",
]);

export const seedMethodEnum = pgEnum("seed_method", [
  "manual",
  "random",
  "by_rank",
  "by_region",
]);

export const winMethodEnum = pgEnum("win_method", [
  "ippon",
  "hansoku",
  "hantei",
  "forfeit",
  "disqualification",
  "bye",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const nextMatchSlotEnum = pgEnum("next_match_slot", [
  "player1",
  "player2",
]);

export const pointTypeEnum = pgEnum("point_type", [
  "men",
  "kote",
  "do",
  "tsuki",
  "hansoku",
]);

export const brackets = pgTable("brackets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: bracketTypeEnum("type").notNull(),
  format: bracketFormatEnum("format").notNull(),
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  minRank: text("min_rank"),
  maxRank: text("max_rank"),
  gender: bracketGenderEnum("gender").notNull().default("any"),
  matchDurationSeconds: integer("match_duration_seconds")
    .notNull()
    .default(300),
  extensionDurationSeconds: integer("extension_duration_seconds")
    .notNull()
    .default(180),
  maxExtensions: integer("max_extensions").notNull().default(1),
  ipponToWin: integer("ippon_to_win").notNull().default(2),
  hansokuLimit: integer("hansoku_limit").notNull().default(2),
  allowsEncho: boolean("allows_encho").notNull().default(true),
  enchoHantei: boolean("encho_hantei").notNull().default(true),
  kachinukiTeamSize: integer("kachinuki_team_size"),
  kachinukiCarryOverIppon: boolean("kachinuki_carry_over_ippon")
    .notNull()
    .default(false),
  status: bracketStatusEnum("status").notNull().default("setup"),
  seedMethod: seedMethodEnum("seed_method").notNull().default("manual"),
  bracketData: jsonb("bracket_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const bracketEntries = pgTable("bracket_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bracketId: text("bracket_id")
    .notNull()
    .references(() => brackets.id, { onDelete: "cascade" }),
  registrationId: text("registration_id").references(() => registrations.id),
  teamId: text("team_id").references(() => teams.id),
  seedNumber: integer("seed_number"),
  poolNumber: integer("pool_number"),
  eliminated: boolean("eliminated").notNull().default(false),
  finalPlacement: integer("final_placement"),
});

export const matches = pgTable("matches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bracketId: text("bracket_id")
    .notNull()
    .references(() => brackets.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  matchNumber: integer("match_number").notNull(),
  courtNumber: integer("court_number"),
  player1EntryId: text("player1_entry_id").references(
    () => bracketEntries.id
  ),
  player2EntryId: text("player2_entry_id").references(
    () => bracketEntries.id
  ),
  player1FighterId: text("player1_fighter_id").references(
    () => registrations.id
  ),
  player2FighterId: text("player2_fighter_id").references(
    () => registrations.id
  ),
  winnerEntryId: text("winner_entry_id").references(() => bracketEntries.id),
  winMethod: winMethodEnum("win_method"),
  status: matchStatusEnum("status").notNull().default("scheduled"),
  scheduledTime: timestamp("scheduled_time"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  // Self-referencing FK: references matches.id
  nextMatchId: text("next_match_id"),
  nextMatchSlot: nextMatchSlotEnum("next_match_slot"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const matchPoints = pgTable("match_points", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  matchId: text("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  scoringEntryId: text("scoring_entry_id")
    .notNull()
    .references(() => bracketEntries.id),
  scoringFighterId: text("scoring_fighter_id").references(
    () => registrations.id
  ),
  pointType: pointTypeEnum("point_type").notNull(),
  isHansoku: boolean("is_hansoku").notNull().default(false),
  hansokuAgainstEntryId: text("hansoku_against_entry_id").references(
    () => bracketEntries.id
  ),
  timeRemainingSeconds: integer("time_remaining_seconds"),
  isEncho: boolean("is_encho").notNull().default(false),
  pointOrder: integer("point_order").notNull(),
  recordedBy: text("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
