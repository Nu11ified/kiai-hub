import { Elysia } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import { dojoMembers } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "./auth.js";

type DojoRole = "owner" | "admin" | "volunteer";

export const dojoAccess = new Elysia({ name: "dojoAccess" })
  .use(requireAuth)
  .derive({ as: "scoped" }, async ({ user, params }) => {
    const dojoId = (params as Record<string, string>).dojoId;
    if (!dojoId) throw new Error("Missing dojoId param");

    const db = getDb();
    const member = await db
      .select()
      .from(dojoMembers)
      .where(
        and(
          eq(dojoMembers.dojoId, dojoId),
          eq(dojoMembers.userId, user!.id),
          eq(dojoMembers.inviteStatus, "accepted"),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!member) {
      throw new Error("Forbidden");
    }

    return {
      dojoMember: member,
      dojoRole: member.role as DojoRole,
    };
  })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN" && error.message === "Forbidden") {
      return new Response(JSON.stringify({ error: "Not a member of this dojo" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });

export const requireDojoAdmin = new Elysia({ name: "requireDojoAdmin" })
  .use(dojoAccess)
  .derive({ as: "scoped" }, ({ dojoRole }) => {
    if (dojoRole !== "owner" && dojoRole !== "admin") {
      throw new Error("AdminRequired");
    }
    return {};
  })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN" && error.message === "AdminRequired") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });

export const requireDojoOwner = new Elysia({ name: "requireDojoOwner" })
  .use(dojoAccess)
  .derive({ as: "scoped" }, ({ dojoRole }) => {
    if (dojoRole !== "owner") {
      throw new Error("OwnerRequired");
    }
    return {};
  })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN" && error.message === "OwnerRequired") {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
