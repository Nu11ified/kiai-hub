import { Elysia, t } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import { dojos, dojoMembers, ownershipTransfers, users } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const dojoRoutes = new Elysia({ prefix: "/dojos" })
  .use(requireAuth)

  // POST /dojos — Create dojo, caller becomes owner
  .post("/", async ({ user, body }) => {
    const db = getDb();

    const [dojo] = await db.insert(dojos).values({
      name: body.name,
      slug: body.slug,
      description: body.description,
      federation: body.federation,
      contactEmail: body.contactEmail,
      timezone: body.timezone,
      website: body.website,
    }).returning();

    await db.insert(dojoMembers).values({
      dojoId: dojo.id,
      userId: user.id,
      role: "owner",
      inviteStatus: "accepted",
    });

    return dojo;
  }, {
    body: t.Object({
      name: t.String(),
      slug: t.String(),
      description: t.Optional(t.String()),
      federation: t.Optional(t.String()),
      contactEmail: t.Optional(t.String()),
      timezone: t.Optional(t.String()),
      website: t.Optional(t.String()),
    }),
  })

  // GET /dojos — List dojos the current user belongs to
  .get("/", async ({ user }) => {
    const db = getDb();

    const results = await db
      .select({
        dojo: dojos,
        role: dojoMembers.role,
      })
      .from(dojoMembers)
      .innerJoin(dojos, eq(dojoMembers.dojoId, dojos.id))
      .where(
        and(
          eq(dojoMembers.userId, user.id),
          eq(dojoMembers.inviteStatus, "accepted"),
        ),
      );

    return results;
  })

  // Dojo-scoped routes
  .group("/:dojoId", (app) =>
    app
      .use(dojoAccess)

      // GET /:dojoId — Get dojo details
      .get("/", async ({ params }) => {
        const db = getDb();
        const dojo = await db
          .select()
          .from(dojos)
          .where(eq(dojos.id, params.dojoId))
          .then((rows) => rows[0] ?? null);

        if (!dojo) {
          return new Response(JSON.stringify({ error: "Dojo not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        return dojo;
      })

      // PATCH /:dojoId — Update dojo (admin+ only)
      .patch("/", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();
        const [updated] = await db
          .update(dojos)
          .set({
            name: body.name,
            slug: body.slug,
            description: body.description,
            federation: body.federation,
            contactEmail: body.contactEmail,
            timezone: body.timezone,
            website: body.website,
            address: body.address,
            city: body.city,
            state: body.state,
            country: body.country,
          })
          .where(eq(dojos.id, params.dojoId))
          .returning();

        return updated;
      }, {
        body: t.Object({
          name: t.Optional(t.String()),
          slug: t.Optional(t.String()),
          description: t.Optional(t.String()),
          federation: t.Optional(t.String()),
          contactEmail: t.Optional(t.String()),
          timezone: t.Optional(t.String()),
          website: t.Optional(t.String()),
          address: t.Optional(t.String()),
          city: t.Optional(t.String()),
          state: t.Optional(t.String()),
          country: t.Optional(t.String()),
        }),
      })

      // DELETE /:dojoId — Delete dojo (owner only)
      .delete("/", async ({ params, dojoRole }) => {
        if (dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();
        await db.delete(dojos).where(eq(dojos.id, params.dojoId));

        return { success: true };
      })

      // GET /:dojoId/members — List members with user info
      .get("/members", async ({ params }) => {
        const db = getDb();

        const members = await db
          .select({
            member: dojoMembers,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(dojoMembers)
          .innerJoin(users, eq(dojoMembers.userId, users.id))
          .where(eq(dojoMembers.dojoId, params.dojoId));

        return members;
      })

      // POST /:dojoId/invite — Invite by email (admin+)
      .post("/invite", async ({ params, body, dojoRole, user }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();

        // Find user by email
        const targetUser = await db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .then((rows) => rows[0] ?? null);

        if (!targetUser) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check not already a member
        const existing = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, targetUser.id),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          return new Response(JSON.stringify({ error: "User is already a member or has a pending invite" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        const role = body.role ?? "volunteer";

        const [member] = await db.insert(dojoMembers).values({
          dojoId: params.dojoId,
          userId: targetUser.id,
          role,
          invitedBy: user.id,
          inviteStatus: "pending",
        }).returning();

        return member;
      }, {
        body: t.Object({
          email: t.String(),
          role: t.Optional(t.Union([t.Literal("admin"), t.Literal("volunteer")])),
        }),
      })

      // PATCH /:dojoId/members/:memberId — Update role (admin+)
      .patch("/members/:memberId", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();

        const member = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.id, params.memberId),
              eq(dojoMembers.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!member) {
          return new Response(JSON.stringify({ error: "Member not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Can't change owner role
        if (member.role === "owner") {
          return new Response(JSON.stringify({ error: "Cannot change owner role" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Only owner can promote to admin
        if (body.role === "admin" && dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Only owner can promote to admin" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const [updated] = await db
          .update(dojoMembers)
          .set({ role: body.role })
          .where(eq(dojoMembers.id, params.memberId))
          .returning();

        return updated;
      }, {
        body: t.Object({
          role: t.Union([t.Literal("admin"), t.Literal("volunteer")]),
        }),
      })

      // DELETE /:dojoId/members/:memberId — Remove member (admin+)
      .delete("/members/:memberId", async ({ params, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();

        const member = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.id, params.memberId),
              eq(dojoMembers.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!member) {
          return new Response(JSON.stringify({ error: "Member not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (member.role === "owner") {
          return new Response(JSON.stringify({ error: "Cannot remove owner" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        await db.delete(dojoMembers).where(eq(dojoMembers.id, params.memberId));

        return { success: true };
      })

      // POST /:dojoId/transfer-ownership — Initiate ownership transfer (owner only)
      .post("/transfer-ownership", async ({ params, body, dojoRole, user }) => {
        if (dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDb();

        // Target must be admin in dojo
        const targetMember = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, body.toUserId),
              eq(dojoMembers.role, "admin"),
              eq(dojoMembers.inviteStatus, "accepted"),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!targetMember) {
          return new Response(JSON.stringify({ error: "Target user must be an admin of this dojo" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Cancel any pending transfers
        await db
          .update(ownershipTransfers)
          .set({ status: "cancelled", resolvedAt: new Date() })
          .where(
            and(
              eq(ownershipTransfers.dojoId, params.dojoId),
              eq(ownershipTransfers.status, "pending"),
            ),
          );

        const [transfer] = await db.insert(ownershipTransfers).values({
          dojoId: params.dojoId,
          fromUserId: user.id,
          toUserId: body.toUserId,
          status: "pending",
        }).returning();

        return transfer;
      }, {
        body: t.Object({
          toUserId: t.String(),
        }),
      })

      // POST /:dojoId/transfer-ownership/:transferId/accept — Accept transfer (target user only)
      .post("/transfer-ownership/:transferId/accept", async ({ params, user }) => {
        const db = getDb();

        const transfer = await db
          .select()
          .from(ownershipTransfers)
          .where(
            and(
              eq(ownershipTransfers.id, params.transferId),
              eq(ownershipTransfers.dojoId, params.dojoId),
              eq(ownershipTransfers.status, "pending"),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!transfer) {
          return new Response(JSON.stringify({ error: "Transfer not found or not pending" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (transfer.toUserId !== user.id) {
          return new Response(JSON.stringify({ error: "Only the target user can accept" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Swap roles: old owner -> admin, new owner -> owner
        await db
          .update(dojoMembers)
          .set({ role: "admin" })
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, transfer.fromUserId),
            ),
          );

        await db
          .update(dojoMembers)
          .set({ role: "owner" })
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, transfer.toUserId),
            ),
          );

        // Update transfer status
        const [updated] = await db
          .update(ownershipTransfers)
          .set({ status: "accepted", resolvedAt: new Date() })
          .where(eq(ownershipTransfers.id, params.transferId))
          .returning();

        return updated;
      })

      // POST /:dojoId/transfer-ownership/:transferId/decline — Decline transfer (target user only)
      .post("/transfer-ownership/:transferId/decline", async ({ params, user }) => {
        const db = getDb();

        const transfer = await db
          .select()
          .from(ownershipTransfers)
          .where(
            and(
              eq(ownershipTransfers.id, params.transferId),
              eq(ownershipTransfers.dojoId, params.dojoId),
              eq(ownershipTransfers.status, "pending"),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!transfer) {
          return new Response(JSON.stringify({ error: "Transfer not found or not pending" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (transfer.toUserId !== user.id) {
          return new Response(JSON.stringify({ error: "Only the target user can decline" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const [updated] = await db
          .update(ownershipTransfers)
          .set({ status: "declined", resolvedAt: new Date() })
          .where(eq(ownershipTransfers.id, params.transferId))
          .returning();

        return updated;
      }),
  );
