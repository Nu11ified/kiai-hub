import { Elysia, t } from "elysia";
import { eq, and, asc } from "@kiai-hub/db/operators";
import { eventPricingTiers, events } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const eventPricingRoutes = new Elysia({
  prefix: "/events/dojo/:dojoId/:eventId/pricing",
})
  .use(dojoAccess)

  // List pricing tiers for event
  .get("/", async ({ params }) => {
    const db = getDb();

    // Verify event belongs to this dojo
    const event = await db
      .select({ id: events.id })
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

    const tiers = await db
      .select()
      .from(eventPricingTiers)
      .where(eq(eventPricingTiers.eventId, params.eventId))
      .orderBy(asc(eventPricingTiers.sortOrder));

    return { data: tiers };
  })

  // Create pricing tier (admin+)
  .post(
    "/",
    async ({ params, body }) => {
      const db = getDb();

      // Verify event belongs to this dojo
      const event = await db
        .select({ id: events.id })
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

      const created = await db
        .insert(eventPricingTiers)
        .values({
          eventId: params.eventId,
          name: body.name,
          description: body.description,
          priceInCents: body.priceInCents,
          maxQuantity: body.maxQuantity,
          applicableTo: body.applicableTo,
          earlyBirdPriceInCents: body.earlyBirdPriceInCents,
          earlyBirdDeadline: body.earlyBirdDeadline
            ? new Date(body.earlyBirdDeadline)
            : undefined,
          sortOrder: body.sortOrder,
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
        description: t.Optional(t.String()),
        priceInCents: t.Number(),
        maxQuantity: t.Optional(t.Number()),
        applicableTo: t.Optional(
          t.Union([
            t.Literal("individual"),
            t.Literal("team"),
            t.Literal("both"),
          ]),
        ),
        earlyBirdPriceInCents: t.Optional(t.Number()),
        earlyBirdDeadline: t.Optional(t.String()),
        sortOrder: t.Optional(t.Number()),
      }),
    },
  )

  // Update pricing tier (admin+)
  .patch(
    "/:tierId",
    async ({ params, body }) => {
      const db = getDb();

      // Verify event belongs to this dojo
      const event = await db
        .select({ id: events.id })
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

      // Verify tier belongs to this event
      const tier = await db
        .select({ id: eventPricingTiers.id })
        .from(eventPricingTiers)
        .where(
          and(
            eq(eventPricingTiers.id, params.tierId),
            eq(eventPricingTiers.eventId, params.eventId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!tier) {
        return new Response(
          JSON.stringify({ error: "Pricing tier not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.priceInCents !== undefined) updateData.priceInCents = body.priceInCents;
      if (body.maxQuantity !== undefined) updateData.maxQuantity = body.maxQuantity;
      if (body.applicableTo !== undefined) updateData.applicableTo = body.applicableTo;
      if (body.earlyBirdPriceInCents !== undefined)
        updateData.earlyBirdPriceInCents = body.earlyBirdPriceInCents;
      if (body.earlyBirdDeadline !== undefined)
        updateData.earlyBirdDeadline = new Date(body.earlyBirdDeadline);
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

      const updated = await db
        .update(eventPricingTiers)
        .set(updateData)
        .where(eq(eventPricingTiers.id, params.tierId))
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
        description: t.Optional(t.String()),
        priceInCents: t.Optional(t.Number()),
        maxQuantity: t.Optional(t.Number()),
        applicableTo: t.Optional(
          t.Union([
            t.Literal("individual"),
            t.Literal("team"),
            t.Literal("both"),
          ]),
        ),
        earlyBirdPriceInCents: t.Optional(t.Number()),
        earlyBirdDeadline: t.Optional(t.String()),
        sortOrder: t.Optional(t.Number()),
      }),
    },
  )

  // Delete pricing tier (admin+)
  .delete("/:tierId", async ({ params }) => {
    const db = getDb();

    // Verify event belongs to this dojo
    const event = await db
      .select({ id: events.id })
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

    // Verify tier belongs to this event
    const tier = await db
      .select({ id: eventPricingTiers.id })
      .from(eventPricingTiers)
      .where(
        and(
          eq(eventPricingTiers.id, params.tierId),
          eq(eventPricingTiers.eventId, params.eventId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!tier) {
      return new Response(
        JSON.stringify({ error: "Pricing tier not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    await db
      .delete(eventPricingTiers)
      .where(eq(eventPricingTiers.id, params.tierId));

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
  });
