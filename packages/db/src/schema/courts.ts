import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { events } from "./events.js";
import { bracketEntries, matches } from "./brackets.js";
import { registrations } from "./registrations.js";

export const shinpanRoleEnum = pgEnum("shinpan_role", [
  "shushin",
  "fukushin",
]);

export const lineupPositionEnum = pgEnum("lineup_position", [
  "senpo",
  "jiho",
  "chuken",
  "fukusho",
  "taisho",
]);

export const courts = pgTable("courts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  courtNumber: integer("court_number").notNull(),
  name: text("name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shinpanAssignments = pgTable("shinpan_assignments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  courtId: text("court_id")
    .notNull()
    .references(() => courts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  shinpanName: text("shinpan_name").notNull(),
  role: shinpanRoleEnum("role").notNull(),
  matchId: text("match_id").references(() => matches.id),
  rotationGroup: integer("rotation_group").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamLineups = pgTable(
  "team_lineups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bracketEntryId: text("bracket_entry_id")
      .notNull()
      .references(() => bracketEntries.id, { onDelete: "cascade" }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id),
    position: lineupPositionEnum("position").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("team_lineups_entry_position").on(
      table.bracketEntryId,
      table.position
    ),
  ]
);
