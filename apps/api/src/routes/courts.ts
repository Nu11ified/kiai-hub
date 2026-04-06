import { Elysia, t } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import { courts, shinpanAssignments } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess, requireDojoAdmin } from "../middleware/dojo-access.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// courtRoutes — requires auth
// ---------------------------------------------------------------------------

export const courtRoutes = new Elysia({ prefix: "/courts" })
  .use(requireAuth)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return jsonResponse({ error: error.message }, 500);
    }
  })

  // -------------------------------------------------------------------------
  // Dojo-scoped court & shinpan management
  // -------------------------------------------------------------------------
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)
      .use(requireDojoAdmin)

      // POST /dojo/:dojoId/event/:eventId/courts — create courts for event
      .post(
        "/event/:eventId/courts",
        async ({ params, body }) => {
          const db = getDb();
          const { count, names } = body;

          const values = Array.from({ length: count }, (_, i) => ({
            eventId: params.eventId,
            courtNumber: i + 1,
            name: names?.[i] ?? null,
          }));

          const created = await db
            .insert(courts)
            .values(values)
            .returning();

          return created;
        },
        {
          body: t.Object({
            count: t.Number({ minimum: 1, maximum: 20 }),
            names: t.Optional(t.Array(t.String())),
          }),
        }
      )

      // GET /dojo/:dojoId/event/:eventId/courts — list courts for event
      .get("/event/:eventId/courts", async ({ params }) => {
        const db = getDb();

        const result = await db
          .select()
          .from(courts)
          .where(eq(courts.eventId, params.eventId));

        return result;
      })

      // DELETE /dojo/:dojoId/courts/:courtId — delete a court
      .delete("/courts/:courtId", async ({ params }) => {
        const db = getDb();

        const court = await db
          .select()
          .from(courts)
          .where(eq(courts.id, params.courtId))
          .then((rows) => rows[0] ?? null);

        if (!court) {
          return jsonResponse({ error: "Court not found" }, 404);
        }

        await db
          .delete(courts)
          .where(eq(courts.id, params.courtId));

        return { success: true };
      })

      // POST /dojo/:dojoId/courts/:courtId/shinpan — assign shinpan to court
      .post(
        "/courts/:courtId/shinpan",
        async ({ params, body }) => {
          const db = getDb();

          const court = await db
            .select()
            .from(courts)
            .where(eq(courts.id, params.courtId))
            .then((rows) => rows[0] ?? null);

          if (!court) {
            return jsonResponse({ error: "Court not found" }, 404);
          }

          const [assignment] = await db
            .insert(shinpanAssignments)
            .values({
              courtId: params.courtId,
              shinpanName: body.shinpanName,
              role: body.role,
              userId: body.userId ?? null,
              rotationGroup: body.rotationGroup ?? 0,
            })
            .returning();

          return assignment;
        },
        {
          body: t.Object({
            shinpanName: t.String(),
            role: t.Union([t.Literal("shushin"), t.Literal("fukushin")]),
            userId: t.Optional(t.String()),
            rotationGroup: t.Optional(t.Number()),
          }),
        }
      )

      // GET /dojo/:dojoId/courts/:courtId/shinpan — list shinpan for court
      .get("/courts/:courtId/shinpan", async ({ params }) => {
        const db = getDb();

        const court = await db
          .select()
          .from(courts)
          .where(eq(courts.id, params.courtId))
          .then((rows) => rows[0] ?? null);

        if (!court) {
          return jsonResponse({ error: "Court not found" }, 404);
        }

        const assignments = await db
          .select()
          .from(shinpanAssignments)
          .where(eq(shinpanAssignments.courtId, params.courtId));

        return assignments;
      })

      // DELETE /dojo/:dojoId/shinpan/:assignmentId — remove shinpan assignment
      .delete("/shinpan/:assignmentId", async ({ params }) => {
        const db = getDb();

        const assignment = await db
          .select()
          .from(shinpanAssignments)
          .where(eq(shinpanAssignments.id, params.assignmentId))
          .then((rows) => rows[0] ?? null);

        if (!assignment) {
          return jsonResponse({ error: "Shinpan assignment not found" }, 404);
        }

        await db
          .delete(shinpanAssignments)
          .where(eq(shinpanAssignments.id, params.assignmentId));

        return { success: true };
      })
  );
