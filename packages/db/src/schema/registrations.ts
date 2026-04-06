import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { events } from "./events.js";
import { eventPricingTiers } from "./events.js";

export const teamStatusEnum = pgEnum("team_status", [
  "forming",
  "confirmed",
  "withdrawn",
]);

export const registrationTypeEnum = pgEnum("registration_type", [
  "individual",
  "team",
  "minor",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
  "failed",
  "waived",
]);

export const waiverStatusEnum = pgEnum("waiver_status", [
  "not_required",
  "pending",
  "signed",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "confirmed",
  "waitlisted",
  "cancelled",
  "checked_in",
]);

export const teams = pgTable("teams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  name: text("name").notNull(),
  captainUserId: text("captain_user_id")
    .notNull()
    .references(() => users.id),
  dojoName: text("dojo_name"),
  maxMembers: integer("max_members").notNull().default(5),
  status: teamStatusEnum("status").notNull().default("forming"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const registrations = pgTable("registrations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id").references(() => users.id),
  registrationType: registrationTypeEnum("registration_type").notNull(),
  teamId: text("team_id").references(() => teams.id),
  participantName: text("participant_name").notNull(),
  participantEmail: text("participant_email").notNull(),
  participantDateOfBirth: date("participant_date_of_birth"),
  participantRank: text("participant_rank"),
  participantFederation: text("participant_federation"),
  participantDojoName: text("participant_dojo_name"),
  isMinor: boolean("is_minor").notNull().default(false),
  guardianName: text("guardian_name"),
  guardianEmail: text("guardian_email"),
  guardianPhone: text("guardian_phone"),
  guardianUserId: text("guardian_user_id").references(() => users.id),
  pricingTierId: text("pricing_tier_id").references(
    () => eventPricingTiers.id
  ),
  amountPaidInCents: integer("amount_paid_in_cents"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("pending"),
  waiverStatus: waiverStatusEnum("waiver_status")
    .notNull()
    .default("pending"),
  docusealSubmissionId: text("docuseal_submission_id"),
  formResponses: jsonb("form_responses"),
  status: registrationStatusEnum("status").notNull().default("pending"),
  checkedInAt: timestamp("checked_in_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});
