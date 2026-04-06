import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { dojos } from "./dojos.js";

export const eventTypeEnum = pgEnum("event_type", [
  "taikai",
  "seminar",
  "shinsa",
  "gasshuku",
  "practice",
  "other",
]);

export const eventVisibilityEnum = pgEnum("event_visibility", [
  "public",
  "private",
  "unlisted",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const pricingApplicableToEnum = pgEnum("pricing_applicable_to", [
  "individual",
  "team",
  "both",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "radio",
  "date",
  "file",
  "number",
]);

export const events = pgTable(
  "events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dojoId: text("dojo_id")
      .notNull()
      .references(() => dojos.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: eventTypeEnum("type").notNull(),
    description: text("description"),
    visibility: eventVisibilityEnum("visibility").notNull().default("public"),
    status: eventStatusEnum("status").notNull().default("draft"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    registrationOpenDate: timestamp("registration_open_date"),
    registrationCloseDate: timestamp("registration_close_date"),
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    venueCity: text("venue_city"),
    venueState: text("venue_state"),
    venueCountry: text("venue_country"),
    currency: text("currency").notNull().default("USD"),
    allowTeamRegistration: boolean("allow_team_registration")
      .notNull()
      .default(false),
    allowIndividualRegistration: boolean("allow_individual_registration")
      .notNull()
      .default(true),
    allowMinorRegistration: boolean("allow_minor_registration")
      .notNull()
      .default(true),
    requireWaiver: boolean("require_waiver").notNull().default(true),
    maxParticipants: integer("max_participants"),
    bannerImageKey: text("banner_image_key"),
    rulesDocumentKey: text("rules_document_key"),
    rulesConfig: jsonb("rules_config"),
    customAssets: jsonb("custom_assets"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("events_dojo_slug_unique").on(table.dojoId, table.slug)]
);

export const eventPricingTiers = pgTable("event_pricing_tiers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceInCents: integer("price_in_cents").notNull(),
  maxQuantity: integer("max_quantity"),
  applicableTo: pricingApplicableToEnum("applicable_to")
    .notNull()
    .default("individual"),
  earlyBirdPriceInCents: integer("early_bird_price_in_cents"),
  earlyBirdDeadline: timestamp("early_bird_deadline"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customFormFields = pgTable("custom_form_fields", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: customFieldTypeEnum("type").notNull(),
  options: jsonb("options"),
  required: boolean("required").notNull().default(false),
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  validationRules: jsonb("validation_rules"),
  sortOrder: integer("sort_order").notNull().default(0),
  section: text("section"),
});
