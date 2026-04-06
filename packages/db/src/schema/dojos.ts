import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const payoutMethodEnum = pgEnum("payout_method", [
  "stripe_connect",
  "paypal",
  "zelle",
]);

export const dojoMemberRoleEnum = pgEnum("dojo_member_role", [
  "owner",
  "admin",
  "volunteer",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "declined",
]);

export const ownershipTransferStatusEnum = pgEnum(
  "ownership_transfer_status",
  ["pending", "accepted", "declined", "cancelled"]
);

export const dojos = pgTable("dojos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoKey: text("logo_key"),
  federation: text("federation"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  timezone: text("timezone").notNull().default("America/New_York"),
  website: text("website"),
  contactEmail: text("contact_email"),
  payoutMethod: payoutMethodEnum("payout_method"),
  payoutEmail: text("payout_email"),
  stripeConnectId: text("stripe_connect_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const dojoMembers = pgTable(
  "dojo_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dojoId: text("dojo_id")
      .notNull()
      .references(() => dojos.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: dojoMemberRoleEnum("role").notNull(),
    invitedBy: text("invited_by").references(() => users.id),
    inviteStatus: inviteStatusEnum("invite_status")
      .notNull()
      .default("accepted"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique("dojo_members_dojo_user_unique").on(table.dojoId, table.userId)]
);

export const ownershipTransfers = pgTable("ownership_transfers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dojoId: text("dojo_id")
    .notNull()
    .references(() => dojos.id),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id),
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id),
  status: ownershipTransferStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});
