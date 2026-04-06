import { Elysia, t } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import {
  brackets,
  bracketEntries,
  matches,
  registrations,
} from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess, requireDojoAdmin } from "../middleware/dojo-access.js";
import {
  seedEntries,
  generateSingleElimination,
  generateRoundRobin,
  generateKachinukiBracket,
  generatePoolStage,
  assignMatchesToCourts,
  computeStandingsFromMatches,
  type BracketEntry,
} from "@kiai-hub/shared";

// ── Helper ──────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
    age--;
  return age;
}

// ── Route ───────────────────────────────────────────────────────────────────

export const bracketRoutes = new Elysia({ prefix: "/brackets" })
  .use(requireAuth)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  })

  // ── Public read endpoints ─────────────────────────────────────────────────

  // GET /brackets/event/:eventId — list all brackets for an event
  .get("/event/:eventId", async ({ params }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(brackets)
      .where(eq(brackets.eventId, params.eventId));
    return { data: rows };
  })

  // GET /brackets/:bracketId — get bracket by ID
  .get("/:bracketId", async ({ params }) => {
    const db = getDb();
    const bracket = await db
      .select()
      .from(brackets)
      .where(eq(brackets.id, params.bracketId))
      .then((rows) => rows[0] ?? null);

    if (!bracket) {
      return new Response(
        JSON.stringify({ error: "Bracket not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return bracket;
  })

  // GET /brackets/:bracketId/matches — list matches for bracket
  .get("/:bracketId/matches", async ({ params }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(matches)
      .where(eq(matches.bracketId, params.bracketId));
    return { data: rows };
  })

  // GET /brackets/:bracketId/entries — list entries with registration data
  .get("/:bracketId/entries", async ({ params }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: bracketEntries.id,
        bracketId: bracketEntries.bracketId,
        registrationId: bracketEntries.registrationId,
        teamId: bracketEntries.teamId,
        seedNumber: bracketEntries.seedNumber,
        poolNumber: bracketEntries.poolNumber,
        eliminated: bracketEntries.eliminated,
        finalPlacement: bracketEntries.finalPlacement,
        participantName: registrations.participantName,
        participantRank: registrations.participantRank,
        participantFederation: registrations.participantFederation,
        participantDateOfBirth: registrations.participantDateOfBirth,
        participantDojoName: registrations.participantDojoName,
      })
      .from(bracketEntries)
      .leftJoin(
        registrations,
        eq(bracketEntries.registrationId, registrations.id),
      )
      .where(eq(bracketEntries.bracketId, params.bracketId));

    return { data: rows };
  })

  // GET /brackets/:bracketId/standings — compute standings (RR/pool formats only)
  .get("/:bracketId/standings", async ({ params }) => {
    const db = getDb();

    const bracket = await db
      .select()
      .from(brackets)
      .where(eq(brackets.id, params.bracketId))
      .then((rows) => rows[0] ?? null);

    if (!bracket) {
      return new Response(
        JSON.stringify({ error: "Bracket not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      bracket.format !== "round_robin" &&
      bracket.format !== "pool_to_elimination"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Standings are only available for round_robin and pool_to_elimination brackets",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const entries = await db
      .select()
      .from(bracketEntries)
      .where(eq(bracketEntries.bracketId, params.bracketId));

    const completedMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.bracketId, params.bracketId),
          eq(matches.status, "completed"),
        ),
      );

    const entryIds = entries.map((e) => e.id);

    // Build match data for standings computation
    const matchData = completedMatches
      .filter(
        (m) =>
          m.player1EntryId !== null &&
          m.player2EntryId !== null,
      )
      .map((m) => ({
        player1EntryId: m.player1EntryId!,
        player2EntryId: m.player2EntryId!,
        winnerEntryId: m.winnerEntryId,
        winMethod: m.winMethod,
        player1Ippon: 0,
        player2Ippon: 0,
      }));

    const standings = computeStandingsFromMatches(entryIds, matchData);
    return { data: standings };
  })

  // ── Dojo-scoped admin routes ───────────────────────────────────────────────
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)
      .use(requireDojoAdmin)

      // POST /brackets/dojo/:dojoId/create — create bracket
      .post(
        "/create",
        async ({ body }) => {
          const db = getDb();
          const created = await db
            .insert(brackets)
            .values({
              eventId: body.eventId,
              name: body.name,
              type: body.type,
              format: body.format,
              minAge: body.minAge,
              maxAge: body.maxAge,
              minRank: body.minRank,
              maxRank: body.maxRank,
              gender: body.gender ?? "any",
              matchDurationSeconds: body.matchDurationSeconds,
              extensionDurationSeconds: body.extensionDurationSeconds,
              maxExtensions: body.maxExtensions,
              ipponToWin: body.ipponToWin,
              hansokuLimit: body.hansokuLimit,
              allowsEncho: body.allowsEncho,
              enchoHantei: body.enchoHantei,
              kachinukiTeamSize: body.kachinukiTeamSize,
              kachinukiCarryOverIppon: body.kachinukiCarryOverIppon,
              seedMethod: body.seedMethod ?? "manual",
              byeMethod: body.byeMethod ?? "random",
              thirdPlaceMatch: body.thirdPlaceMatch,
            })
            .returning()
            .then((rows) => rows[0]);

          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        },
        {
          body: t.Object({
            eventId: t.String(),
            name: t.String(),
            type: t.Union([t.Literal("individual"), t.Literal("team")]),
            format: t.Union([
              t.Literal("single_elimination"),
              t.Literal("double_elimination"),
              t.Literal("round_robin"),
              t.Literal("kachinuki"),
              t.Literal("pool_to_elimination"),
            ]),
            minAge: t.Optional(t.Number()),
            maxAge: t.Optional(t.Number()),
            minRank: t.Optional(t.String()),
            maxRank: t.Optional(t.String()),
            gender: t.Optional(
              t.Union([
                t.Literal("any"),
                t.Literal("male"),
                t.Literal("female"),
              ]),
            ),
            matchDurationSeconds: t.Optional(t.Number()),
            extensionDurationSeconds: t.Optional(t.Number()),
            maxExtensions: t.Optional(t.Number()),
            ipponToWin: t.Optional(t.Number()),
            hansokuLimit: t.Optional(t.Number()),
            allowsEncho: t.Optional(t.Boolean()),
            enchoHantei: t.Optional(t.Boolean()),
            kachinukiTeamSize: t.Optional(t.Number()),
            kachinukiCarryOverIppon: t.Optional(t.Boolean()),
            seedMethod: t.Optional(
              t.Union([
                t.Literal("manual"),
                t.Literal("random"),
                t.Literal("by_rank"),
                t.Literal("by_region"),
              ]),
            ),
            byeMethod: t.Optional(
              t.Union([
                t.Literal("random"),
                t.Literal("by_rank"),
                t.Literal("by_age"),
              ]),
            ),
            thirdPlaceMatch: t.Optional(t.Boolean()),
          }),
        },
      )

      // POST /brackets/dojo/:dojoId/:bracketId/add-entries
      .post(
        "/:bracketId/add-entries",
        async ({ params, body }) => {
          const db = getDb();

          const bracket = await db
            .select()
            .from(brackets)
            .where(eq(brackets.id, params.bracketId))
            .then((rows) => rows[0] ?? null);

          if (!bracket) {
            return new Response(
              JSON.stringify({ error: "Bracket not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const values = body.registrationIds.map((registrationId) => ({
            bracketId: params.bracketId,
            registrationId,
          }));

          const inserted = await db
            .insert(bracketEntries)
            .values(values)
            .returning();

          return new Response(JSON.stringify({ data: inserted }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        },
        {
          body: t.Object({
            registrationIds: t.Array(t.String()),
          }),
        },
      )

      // POST /brackets/dojo/:dojoId/:bracketId/seed
      .post("/:bracketId/seed", async ({ params }) => {
        const db = getDb();

        const bracket = await db
          .select()
          .from(brackets)
          .where(eq(brackets.id, params.bracketId))
          .then((rows) => rows[0] ?? null);

        if (!bracket) {
          return new Response(
            JSON.stringify({ error: "Bracket not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        // Get entries with registration data
        const entryRows = await db
          .select({
            id: bracketEntries.id,
            seedNumber: bracketEntries.seedNumber,
            participantRank: registrations.participantRank,
            participantDateOfBirth: registrations.participantDateOfBirth,
            participantFederation: registrations.participantFederation,
          })
          .from(bracketEntries)
          .leftJoin(
            registrations,
            eq(bracketEntries.registrationId, registrations.id),
          )
          .where(eq(bracketEntries.bracketId, params.bracketId));

        const bracketEntryList: BracketEntry[] = entryRows.map((row) => ({
          id: row.id,
          seedNumber: row.seedNumber ?? undefined,
          rank: row.participantRank ?? undefined,
          age: row.participantDateOfBirth
            ? calculateAge(row.participantDateOfBirth)
            : undefined,
          region: row.participantFederation ?? undefined,
        }));

        const seeded = seedEntries(
          bracketEntryList,
          (bracket.seedMethod as "manual" | "random" | "by_rank" | "by_region"),
        );

        // Update each entry's seedNumber in DB
        await Promise.all(
          seeded.map((entry) =>
            db
              .update(bracketEntries)
              .set({ seedNumber: entry.seedNumber })
              .where(eq(bracketEntries.id, entry.id)),
          ),
        );

        // Update bracket status to "seeded"
        const updated = await db
          .update(brackets)
          .set({ status: "seeded" })
          .where(eq(brackets.id, params.bracketId))
          .returning()
          .then((rows) => rows[0]);

        return { bracket: updated, entries: seeded };
      })

      // POST /brackets/dojo/:dojoId/:bracketId/generate
      .post(
        "/:bracketId/generate",
        async ({ params, body }) => {
          const db = getDb();

          const bracket = await db
            .select()
            .from(brackets)
            .where(eq(brackets.id, params.bracketId))
            .then((rows) => rows[0] ?? null);

          if (!bracket) {
            return new Response(
              JSON.stringify({ error: "Bracket not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const entryRows = await db
            .select({
              id: bracketEntries.id,
              seedNumber: bracketEntries.seedNumber,
              participantRank: registrations.participantRank,
              participantDateOfBirth: registrations.participantDateOfBirth,
              participantFederation: registrations.participantFederation,
            })
            .from(bracketEntries)
            .leftJoin(
              registrations,
              eq(bracketEntries.registrationId, registrations.id),
            )
            .where(eq(bracketEntries.bracketId, params.bracketId));

          const entries: BracketEntry[] = entryRows.map((row) => ({
            id: row.id,
            seedNumber: row.seedNumber ?? undefined,
            rank: row.participantRank ?? undefined,
            age: row.participantDateOfBirth
              ? calculateAge(row.participantDateOfBirth)
              : undefined,
            region: row.participantFederation ?? undefined,
          }));

          const byeMethod = (bracket.byeMethod ?? "random") as
            | "random"
            | "by_rank"
            | "by_age";
          const thirdPlaceMatch = bracket.thirdPlaceMatch ?? false;
          const courtCount = body?.courtCount ?? 1;
          const poolCount = body?.poolCount ?? 2;
          const advancePerPool = body?.advancePerPool ?? 1;

          // Generate matches based on format
          let generatedMatches;
          switch (bracket.format) {
            case "single_elimination":
              generatedMatches = generateSingleElimination(entries, {
                byeMethod,
                thirdPlaceMatch,
              });
              break;

            case "round_robin":
              generatedMatches = generateRoundRobin(entries, {
                poolCount: body?.poolCount,
              });
              break;

            case "kachinuki":
              generatedMatches = generateKachinukiBracket(entries, {
                carryOverIppon: bracket.kachinukiCarryOverIppon ?? false,
                teamSize: bracket.kachinukiTeamSize ?? 5,
              });
              break;

            case "pool_to_elimination": {
              const result = generatePoolStage(entries, {
                poolCount,
                advancePerPool,
                eliminationByeMethod: byeMethod,
                thirdPlaceMatch,
              });
              generatedMatches = result.poolMatches;
              break;
            }

            case "double_elimination":
              // Fall back to single elimination for now (double elimination not yet implemented)
              generatedMatches = generateSingleElimination(entries, {
                byeMethod,
                thirdPlaceMatch,
              });
              break;

            default:
              return new Response(
                JSON.stringify({ error: "Unsupported bracket format" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
          }

          // Assign courts if courtCount > 1
          let courtAssignments: Map<string, number> | null = null;
          if (courtCount > 1) {
            const assignments = assignMatchesToCourts(
              generatedMatches,
              courtCount,
            );
            courtAssignments = new Map(
              assignments.map((a) => [a.matchId, a.courtNumber]),
            );
          }

          // Insert all generated matches into the DB
          const matchValues = generatedMatches.map((m) => ({
            id: m.id,
            bracketId: params.bracketId,
            roundNumber: m.roundNumber,
            matchNumber: m.matchNumber,
            courtNumber: courtAssignments?.get(m.id) ?? null,
            player1EntryId: m.player1EntryId,
            player2EntryId: m.player2EntryId,
            nextMatchId: m.nextMatchId,
            nextMatchSlot: m.nextMatchSlot as "player1" | "player2" | null,
            // Bye matches are completed immediately
            ...(m.isBye
              ? {
                  status: "completed" as const,
                  winnerEntryId:
                    m.player1EntryId !== null
                      ? m.player1EntryId
                      : m.player2EntryId,
                  winMethod: "bye" as const,
                }
              : {}),
          }));

          if (matchValues.length > 0) {
            await db.insert(matches).values(matchValues);
          }

          // Update bracket status to in_progress
          await db
            .update(brackets)
            .set({ status: "in_progress" })
            .where(eq(brackets.id, params.bracketId));

          return { matchCount: matchValues.length };
        },
        {
          body: t.Optional(
            t.Object({
              courtCount: t.Optional(t.Number()),
              poolCount: t.Optional(t.Number()),
              advancePerPool: t.Optional(t.Number()),
            }),
          ),
        },
      )

      // DELETE /brackets/dojo/:dojoId/:bracketId — delete bracket
      .delete("/:bracketId", async ({ params }) => {
        const db = getDb();

        const bracket = await db
          .select({ id: brackets.id })
          .from(brackets)
          .where(eq(brackets.id, params.bracketId))
          .then((rows) => rows[0] ?? null);

        if (!bracket) {
          return new Response(
            JSON.stringify({ error: "Bracket not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        await db.delete(brackets).where(eq(brackets.id, params.bracketId));

        return { success: true };
      }),
  );
