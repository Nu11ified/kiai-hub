import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@kiai-hub/db";

export function createAuth(opts: {
  database: Database;
  secret: string;
  baseURL: string;
}) {
  return betterAuth({
    database: drizzleAdapter(opts.database, { provider: "pg" }),
    secret: opts.secret,
    baseURL: opts.baseURL,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        dateOfBirth: { type: "string", required: false },
        phone: { type: "string", required: false },
        emergencyContactName: { type: "string", required: false },
        emergencyContactPhone: { type: "string", required: false },
        kendoRank: { type: "string", required: false },
        yearsExperience: { type: "number", required: false },
        federation: { type: "string", required: false },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
