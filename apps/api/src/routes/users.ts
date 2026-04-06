import { Elysia, t } from "elysia";
import { eq } from "@kiai-hub/db/operators";
import { users } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(requireAuth)
  .get("/me", async ({ user }) => {
    const db = getDb();
    const profile = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .then((rows) => rows[0] ?? null);

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    return profile;
  })
  .patch("/me", async ({ user, body }) => {
    const db = getDb();
    const updated = await db
      .update(users)
      .set({
        name: body.name,
        dateOfBirth: body.dateOfBirth,
        phone: body.phone,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        kendoRank: body.kendoRank,
        yearsExperience: body.yearsExperience,
        federation: body.federation,
      })
      .where(eq(users.id, user.id))
      .returning()
      .then((rows) => rows[0]);

    return updated;
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      dateOfBirth: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      emergencyContactName: t.Optional(t.String()),
      emergencyContactPhone: t.Optional(t.String()),
      kendoRank: t.Optional(t.String()),
      yearsExperience: t.Optional(t.Number()),
      federation: t.Optional(t.String()),
    }),
  });
