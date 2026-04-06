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
import { dojos } from "./dojos.js";
import { events } from "./events.js";

export const documentTypeEnum = pgEnum("document_type", [
  "rules",
  "waiver",
  "certificate",
  "roster",
  "bracket_sheet",
  "logo",
  "custom",
]);

export const platformAssetCategoryEnum = pgEnum("platform_asset_category", [
  "logo",
  "header",
  "border",
  "icon",
  "template",
]);

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dojoId: text("dojo_id").references(() => dojos.id),
  eventId: text("event_id").references(() => events.id),
  name: text("name").notNull(),
  type: documentTypeEnum("type").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedBy: text("uploaded_by").references(() => users.id),
  isTemplate: boolean("is_template").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const platformAssets = pgTable("platform_assets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  category: platformAssetCategoryEnum("category").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  mimeType: text("mime_type"),
  tags: jsonb("tags"),
});

export const waiverTemplates = pgTable("waiver_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dojoId: text("dojo_id").references(() => dojos.id),
  eventId: text("event_id").references(() => events.id),
  name: text("name").notNull(),
  docusealTemplateId: text("docuseal_template_id"),
  storageKey: text("storage_key"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
