import { Elysia, t } from "elysia";
import { eq, asc, desc, count } from "@kiai-hub/db/operators";
import { matches, matchPoints, brackets, bracketEntries } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function checkAutoWin(
  points: Array<{
    scoringEntryId: string;
    pointType: string;
    isHansoku: boolean;
    hansokuAgainstEntryId: string | null;
  }>,
  match: { player1EntryId: string | null; player2EntryId: string | null },
  ipponToWin: number,
  hansokuLimit: number
): { winnerEntryId: string; winMethod: string } | null {
  if (!match.player1EntryId || !match.player2EntryId) return null;

  // Count ippon (non-hansoku points) per entry
  const p1Ippon = points.filter(
    (p) => p.scoringEntryId === match.player1EntryId && !p.isHansoku
  ).length;
  const p2Ippon = points.filter(
    (p) => p.scoringEntryId === match.player2EntryId && !p.isHansoku
  ).length;

  if (p1Ippon >= ipponToWin) return { winnerEntryId: match.player1EntryId, winMethod: "ippon" };
  if (p2Ippon >= ipponToWin) return { winnerEntryId: match.player2EntryId, winMethod: "ippon" };

  // Count hansoku AGAINST each entry (2 hansoku = ippon for opponent)
  const p1Hansoku = points.filter(
    (p) => p.hansokuAgainstEntryId === match.player1EntryId
  ).length;
  const p2Hansoku = points.filter(
    (p) => p.hansokuAgainstEntryId === match.player2EntryId
  ).length;

  if (p1Hansoku >= hansokuLimit) return { winnerEntryId: match.player2EntryId, winMethod: "hansoku" };
  if (p2Hansoku >= hansokuLimit) return { winnerEntryId: match.player1EntryId, winMethod: "hansoku" };

  return null;
}

// ---------------------------------------------------------------------------
// Advance winner to next match
// ---------------------------------------------------------------------------

async function advanceWinner(
  matchRecord: typeof matches.$inferSelect,
  winnerEntryId: string
): Promise<void> {
  if (!matchRecord.nextMatchId || !matchRecord.nextMatchSlot) return;

  const db = getDb();

  if (matchRecord.nextMatchSlot === "player1") {
    await db
      .update(matches)
      .set({ player1EntryId: winnerEntryId })
      .where(eq(matches.id, matchRecord.nextMatchId));
  } else {
    await db
      .update(matches)
      .set({ player2EntryId: winnerEntryId })
      .where(eq(matches.id, matchRecord.nextMatchId));
  }
}

// ---------------------------------------------------------------------------
// matchRoutes
// ---------------------------------------------------------------------------

export const matchRoutes = new Elysia({ prefix: "/matches" })
  .use(authMiddleware)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return jsonResponse({ error: error.message }, 500);
    }
  })

  // -------------------------------------------------------------------------
  // GET /:matchId — get match with all its points
  // -------------------------------------------------------------------------
  .get("/:matchId", async ({ params }) => {
    const db = getDb();

    const match = await db
      .select()
      .from(matches)
      .where(eq(matches.id, params.matchId))
      .then((rows) => rows[0] ?? null);

    if (!match) {
      return jsonResponse({ error: "Match not found" }, 404);
    }

    const points = await db
      .select()
      .from(matchPoints)
      .where(eq(matchPoints.matchId, params.matchId))
      .orderBy(asc(matchPoints.pointOrder));

    return { match, points };
  })

  // -------------------------------------------------------------------------
  // POST /:matchId/start — start the match
  // -------------------------------------------------------------------------
  .post("/:matchId/start", async ({ params }) => {
    const db = getDb();

    const match = await db
      .select()
      .from(matches)
      .where(eq(matches.id, params.matchId))
      .then((rows) => rows[0] ?? null);

    if (!match) {
      return jsonResponse({ error: "Match not found" }, 404);
    }

    if (match.status !== "scheduled") {
      return jsonResponse(
        { error: "Match must be in 'scheduled' status to start" },
        400
      );
    }

    const now = new Date();

    const [updatedMatch] = await db
      .update(matches)
      .set({ status: "in_progress", startedAt: now })
      .where(eq(matches.id, params.matchId))
      .returning();

    // Also set bracket status to "in_progress"
    await db
      .update(brackets)
      .set({ status: "in_progress" })
      .where(eq(brackets.id, match.bracketId));

    return { match: updatedMatch };
  })

  // -------------------------------------------------------------------------
  // POST /:matchId/score — record a point
  // -------------------------------------------------------------------------
  .post(
    "/:matchId/score",
    async ({ params, body, store }) => {
      const db = getDb();

      const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, params.matchId))
        .then((rows) => rows[0] ?? null);

      if (!match) {
        return jsonResponse({ error: "Match not found" }, 404);
      }

      if (match.status !== "in_progress") {
        return jsonResponse(
          { error: "Match must be 'in_progress' to record a point" },
          400
        );
      }

      // Calculate pointOrder
      const [{ count: existingCount }] = await db
        .select({ count: count() })
        .from(matchPoints)
        .where(eq(matchPoints.matchId, params.matchId));

      const pointOrder = Number(existingCount) + 1;

      // Get recordedBy from session user if available
      const user = (store as { user?: { id: string } | null })?.user ?? null;

      const [point] = await db
        .insert(matchPoints)
        .values({
          matchId: params.matchId,
          scoringEntryId: body.scoringEntryId,
          scoringFighterId: body.scoringFighterId ?? null,
          pointType: body.pointType,
          isHansoku: body.isHansoku ?? false,
          hansokuAgainstEntryId: body.hansokuAgainstEntryId ?? null,
          timeRemainingSeconds: body.timeRemainingSeconds ?? null,
          isEncho: body.isEncho ?? false,
          pointOrder,
          recordedBy: user?.id ?? null,
        })
        .returning();

      // Fetch all points (including the new one) to check auto-win
      const allPoints = await db
        .select()
        .from(matchPoints)
        .where(eq(matchPoints.matchId, params.matchId))
        .orderBy(asc(matchPoints.pointOrder));

      // Fetch bracket for ipponToWin / hansokuLimit
      const bracket = await db
        .select()
        .from(brackets)
        .where(eq(brackets.id, match.bracketId))
        .then((rows) => rows[0] ?? null);

      const ipponToWin = bracket?.ipponToWin ?? 2;
      const hansokuLimit = bracket?.hansokuLimit ?? 2;

      const autoWin = checkAutoWin(
        allPoints.map((p) => ({
          scoringEntryId: p.scoringEntryId,
          pointType: p.pointType,
          isHansoku: p.isHansoku,
          hansokuAgainstEntryId: p.hansokuAgainstEntryId,
        })),
        match,
        ipponToWin,
        hansokuLimit
      );

      if (autoWin) {
        const now = new Date();

        // Complete the match
        await db
          .update(matches)
          .set({
            status: "completed",
            winnerEntryId: autoWin.winnerEntryId,
            winMethod: autoWin.winMethod as typeof match.winMethod,
            completedAt: now,
          })
          .where(eq(matches.id, params.matchId));

        // Advance winner to next match
        await advanceWinner(match, autoWin.winnerEntryId);

        // Mark loser as eliminated
        const loserEntryId =
          autoWin.winnerEntryId === match.player1EntryId
            ? match.player2EntryId
            : match.player1EntryId;

        if (loserEntryId) {
          await db
            .update(bracketEntries)
            .set({ eliminated: true })
            .where(eq(bracketEntries.id, loserEntryId));
        }

        return { point, autoWin };
      }

      return { point };
    },
    {
      body: t.Object({
        scoringEntryId: t.String(),
        scoringFighterId: t.Optional(t.String()),
        pointType: t.Union([
          t.Literal("men"),
          t.Literal("kote"),
          t.Literal("do"),
          t.Literal("tsuki"),
          t.Literal("hansoku"),
        ]),
        isHansoku: t.Optional(t.Boolean()),
        hansokuAgainstEntryId: t.Optional(t.String()),
        timeRemainingSeconds: t.Optional(t.Number()),
        isEncho: t.Optional(t.Boolean()),
      }),
    }
  )

  // -------------------------------------------------------------------------
  // POST /:matchId/undo-score — delete the last point
  // -------------------------------------------------------------------------
  .post("/:matchId/undo-score", async ({ params }) => {
    const db = getDb();

    const match = await db
      .select()
      .from(matches)
      .where(eq(matches.id, params.matchId))
      .then((rows) => rows[0] ?? null);

    if (!match) {
      return jsonResponse({ error: "Match not found" }, 404);
    }

    if (match.status !== "in_progress") {
      return jsonResponse(
        { error: "Match must be 'in_progress' to undo a point" },
        400
      );
    }

    // Find the last point by highest pointOrder
    const lastPoint = await db
      .select()
      .from(matchPoints)
      .where(eq(matchPoints.matchId, params.matchId))
      .orderBy(desc(matchPoints.pointOrder))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!lastPoint) {
      return jsonResponse({ error: "No points to undo" }, 400);
    }

    await db.delete(matchPoints).where(eq(matchPoints.id, lastPoint.id));

    return { deleted: lastPoint };
  })

  // -------------------------------------------------------------------------
  // POST /:matchId/complete — manually complete a match
  // -------------------------------------------------------------------------
  .post(
    "/:matchId/complete",
    async ({ params, body }) => {
      const db = getDb();

      const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, params.matchId))
        .then((rows) => rows[0] ?? null);

      if (!match) {
        return jsonResponse({ error: "Match not found" }, 404);
      }

      const now = new Date();

      const [updatedMatch] = await db
        .update(matches)
        .set({
          status: "completed",
          winnerEntryId: body.winnerEntryId,
          winMethod: body.winMethod as typeof match.winMethod,
          completedAt: now,
          notes: body.notes ?? match.notes,
        })
        .where(eq(matches.id, params.matchId))
        .returning();

      // Advance winner to next match if nextMatchId exists
      await advanceWinner(match, body.winnerEntryId);

      // Mark loser as eliminated
      const loserEntryId =
        body.winnerEntryId === match.player1EntryId
          ? match.player2EntryId
          : match.player1EntryId;

      if (loserEntryId) {
        await db
          .update(bracketEntries)
          .set({ eliminated: true })
          .where(eq(bracketEntries.id, loserEntryId));
      }

      return { match: updatedMatch };
    },
    {
      body: t.Object({
        winnerEntryId: t.String(),
        winMethod: t.Union([
          t.Literal("ippon"),
          t.Literal("hansoku"),
          t.Literal("hantei"),
          t.Literal("forfeit"),
          t.Literal("disqualification"),
          t.Literal("bye"),
        ]),
        notes: t.Optional(t.String()),
      }),
    }
  );
