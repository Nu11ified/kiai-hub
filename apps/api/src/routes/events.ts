import { Elysia, t } from "elysia";
import { eq, and, desc, asc, sql, count } from "@kiai-hub/db/operators";
import { events, dojos, registrations } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { dojoAccess, requireDojoAdmin } from "../middleware/dojo-access.js";

export const eventRoutes = new Elysia({ prefix: "/events" })
  // ── Public: list published public events ──
  .get(
    "/",
    async ({ query }) => {
      const db = getDb();
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const offset = (page - 1) * limit;

      const rows = await db
        .select({
          id: events.id,
          dojoId: events.dojoId,
          name: events.name,
          slug: events.slug,
          type: events.type,
          description: events.description,
          visibility: events.visibility,
          status: events.status,
          startDate: events.startDate,
          endDate: events.endDate,
          registrationOpenDate: events.registrationOpenDate,
          registrationCloseDate: events.registrationCloseDate,
          venueName: events.venueName,
          venueCity: events.venueCity,
          venueState: events.venueState,
          venueCountry: events.venueCountry,
          currency: events.currency,
          maxParticipants: events.maxParticipants,
          bannerImageKey: events.bannerImageKey,
          createdAt: events.createdAt,
          dojoName: dojos.name,
          dojoSlug: dojos.slug,
        })
        .from(events)
        .innerJoin(dojos, eq(events.dojoId, dojos.id))
        .where(
          and(
            eq(events.visibility, "public"),
            eq(events.status, "published"),
          ),
        )
        .orderBy(desc(events.startDate))
        .limit(limit)
        .offset(offset);

      return { data: rows, page, limit };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // ── Public: get event by dojo slug + event slug ──
  .get(
    "/by-slug/:dojoSlug/:eventSlug",
    async ({ params }) => {
      const db = getDb();

      const dojo = await db
        .select()
        .from(dojos)
        .where(eq(dojos.slug, params.dojoSlug))
        .then((rows) => rows[0] ?? null);

      if (!dojo) {
        return new Response(
          JSON.stringify({ error: "Dojo not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const event = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.dojoId, dojo.id),
            eq(events.slug, params.eventSlug),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!event) {
        return new Response(
          JSON.stringify({ error: "Event not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      return {
        ...event,
        dojoName: dojo.name,
        dojoSlug: dojo.slug,
      };
    },
  )

  // ── Dojo-scoped routes ──
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)

      // List events for this dojo
      .get("/", async ({ params }) => {
        const db = getDb();
        const rows = await db
          .select()
          .from(events)
          .where(eq(events.dojoId, params.dojoId))
          .orderBy(desc(events.startDate));

        return { data: rows };
      })

      // Get single event
      .get("/:eventId", async ({ params }) => {
        const db = getDb();
        const event = await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.id, params.eventId),
              eq(events.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!event) {
          return new Response(
            JSON.stringify({ error: "Event not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        return event;
      })

      // Create event (admin+)
      .post(
        "/",
        async ({ params, body }) => {
          const db = getDb();
          const created = await db
            .insert(events)
            .values({
              dojoId: params.dojoId,
              name: body.name,
              slug: body.slug,
              type: body.type,
              description: body.description,
              startDate: body.startDate ? new Date(body.startDate) : undefined,
              endDate: body.endDate ? new Date(body.endDate) : undefined,
              venueName: body.venueName,
              venueAddress: body.venueAddress,
              venueCity: body.venueCity,
              venueState: body.venueState,
              venueCountry: body.venueCountry,
              currency: body.currency,
              maxParticipants: body.maxParticipants,
              allowTeamRegistration: body.allowTeamRegistration,
              allowIndividualRegistration: body.allowIndividualRegistration,
              allowMinorRegistration: body.allowMinorRegistration,
              requireWaiver: body.requireWaiver,
            })
            .returning()
            .then((rows) => rows[0]);

          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        },
        {
          beforeHandle: ({ dojoRole }) => {
            if (dojoRole !== "owner" && dojoRole !== "admin") {
              return new Response(
                JSON.stringify({ error: "Admin access required" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
              );
            }
          },
          body: t.Object({
            name: t.String(),
            slug: t.String(),
            type: t.Union([
              t.Literal("taikai"),
              t.Literal("seminar"),
              t.Literal("shinsa"),
              t.Literal("gasshuku"),
              t.Literal("practice"),
              t.Literal("other"),
            ]),
            description: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            venueName: t.Optional(t.String()),
            venueAddress: t.Optional(t.String()),
            venueCity: t.Optional(t.String()),
            venueState: t.Optional(t.String()),
            venueCountry: t.Optional(t.String()),
            currency: t.Optional(t.String()),
            maxParticipants: t.Optional(t.Number()),
            allowTeamRegistration: t.Optional(t.Boolean()),
            allowIndividualRegistration: t.Optional(t.Boolean()),
            allowMinorRegistration: t.Optional(t.Boolean()),
            requireWaiver: t.Optional(t.Boolean()),
          }),
        },
      )

      // Update event (admin+)
      .patch(
        "/:eventId",
        async ({ params, body }) => {
          const db = getDb();

          // Verify event belongs to this dojo
          const existing = await db
            .select({ id: events.id })
            .from(events)
            .where(
              and(
                eq(events.id, params.eventId),
                eq(events.dojoId, params.dojoId),
              ),
            )
            .then((rows) => rows[0] ?? null);

          if (!existing) {
            return new Response(
              JSON.stringify({ error: "Event not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const updateData: Record<string, unknown> = {};
          if (body.name !== undefined) updateData.name = body.name;
          if (body.slug !== undefined) updateData.slug = body.slug;
          if (body.type !== undefined) updateData.type = body.type;
          if (body.description !== undefined) updateData.description = body.description;
          if (body.visibility !== undefined) updateData.visibility = body.visibility;
          if (body.status !== undefined) updateData.status = body.status;
          if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
          if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
          if (body.registrationOpenDate !== undefined)
            updateData.registrationOpenDate = new Date(body.registrationOpenDate);
          if (body.registrationCloseDate !== undefined)
            updateData.registrationCloseDate = new Date(body.registrationCloseDate);
          if (body.venueName !== undefined) updateData.venueName = body.venueName;
          if (body.venueAddress !== undefined) updateData.venueAddress = body.venueAddress;
          if (body.venueCity !== undefined) updateData.venueCity = body.venueCity;
          if (body.venueState !== undefined) updateData.venueState = body.venueState;
          if (body.venueCountry !== undefined) updateData.venueCountry = body.venueCountry;
          if (body.currency !== undefined) updateData.currency = body.currency;
          if (body.maxParticipants !== undefined) updateData.maxParticipants = body.maxParticipants;
          if (body.allowTeamRegistration !== undefined)
            updateData.allowTeamRegistration = body.allowTeamRegistration;
          if (body.allowIndividualRegistration !== undefined)
            updateData.allowIndividualRegistration = body.allowIndividualRegistration;
          if (body.allowMinorRegistration !== undefined)
            updateData.allowMinorRegistration = body.allowMinorRegistration;
          if (body.requireWaiver !== undefined) updateData.requireWaiver = body.requireWaiver;

          const updated = await db
            .update(events)
            .set(updateData)
            .where(eq(events.id, params.eventId))
            .returning()
            .then((rows) => rows[0]);

          return updated;
        },
        {
          beforeHandle: ({ dojoRole }) => {
            if (dojoRole !== "owner" && dojoRole !== "admin") {
              return new Response(
                JSON.stringify({ error: "Admin access required" }),
                { status: 403, headers: { "Content-Type": "application/json" } },
              );
            }
          },
          body: t.Object({
            name: t.Optional(t.String()),
            slug: t.Optional(t.String()),
            type: t.Optional(
              t.Union([
                t.Literal("taikai"),
                t.Literal("seminar"),
                t.Literal("shinsa"),
                t.Literal("gasshuku"),
                t.Literal("practice"),
                t.Literal("other"),
              ]),
            ),
            description: t.Optional(t.String()),
            visibility: t.Optional(
              t.Union([
                t.Literal("public"),
                t.Literal("private"),
                t.Literal("unlisted"),
              ]),
            ),
            status: t.Optional(
              t.Union([
                t.Literal("draft"),
                t.Literal("published"),
                t.Literal("registration_open"),
                t.Literal("registration_closed"),
                t.Literal("in_progress"),
                t.Literal("completed"),
                t.Literal("cancelled"),
              ]),
            ),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            registrationOpenDate: t.Optional(t.String()),
            registrationCloseDate: t.Optional(t.String()),
            venueName: t.Optional(t.String()),
            venueAddress: t.Optional(t.String()),
            venueCity: t.Optional(t.String()),
            venueState: t.Optional(t.String()),
            venueCountry: t.Optional(t.String()),
            currency: t.Optional(t.String()),
            maxParticipants: t.Optional(t.Number()),
            allowTeamRegistration: t.Optional(t.Boolean()),
            allowIndividualRegistration: t.Optional(t.Boolean()),
            allowMinorRegistration: t.Optional(t.Boolean()),
            requireWaiver: t.Optional(t.Boolean()),
          }),
        },
      )

      // Delete event (admin+)
      .delete("/:eventId", async ({ params }) => {
        const db = getDb();

        const existing = await db
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.id, params.eventId),
              eq(events.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Event not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        await db.delete(events).where(eq(events.id, params.eventId));

        return { success: true };
      }, {
        beforeHandle: ({ dojoRole }) => {
          if (dojoRole !== "owner" && dojoRole !== "admin") {
            return new Response(
              JSON.stringify({ error: "Admin access required" }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }
        },
      })

      // Publish event (admin+)
      .post("/:eventId/publish", async ({ params }) => {
        const db = getDb();

        const event = await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.id, params.eventId),
              eq(events.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!event) {
          return new Response(
            JSON.stringify({ error: "Event not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        if (event.status !== "draft") {
          return new Response(
            JSON.stringify({ error: "Only draft events can be published" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const updated = await db
          .update(events)
          .set({ status: "published" })
          .where(eq(events.id, params.eventId))
          .returning()
          .then((rows) => rows[0]);

        return updated;
      }, {
        beforeHandle: ({ dojoRole }) => {
          if (dojoRole !== "owner" && dojoRole !== "admin") {
            return new Response(
              JSON.stringify({ error: "Admin access required" }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }
        },
      })

      // Dashboard stats
      .get("/:eventId/dashboard", async ({ params }) => {
        const db = getDb();

        const event = await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.id, params.eventId),
              eq(events.dojoId, params.dojoId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!event) {
          return new Response(
            JSON.stringify({ error: "Event not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const [totalResult] = await db
          .select({ value: count() })
          .from(registrations)
          .where(eq(registrations.eventId, params.eventId));

        const [paidResult] = await db
          .select({ value: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.eventId, params.eventId),
              eq(registrations.paymentStatus, "paid"),
            ),
          );

        const [revenueResult] = await db
          .select({
            value: sql<number>`coalesce(sum(${registrations.amountPaidInCents}), 0)`,
          })
          .from(registrations)
          .where(eq(registrations.eventId, params.eventId));

        return {
          event,
          stats: {
            totalRegistrations: totalResult?.value ?? 0,
            paidRegistrations: paidResult?.value ?? 0,
            totalRevenueCents: Number(revenueResult?.value ?? 0),
          },
        };
      }),
  );
