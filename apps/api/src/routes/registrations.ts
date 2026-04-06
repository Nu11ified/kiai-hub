import { Elysia, t } from "elysia";
import { eq, and, count } from "@kiai-hub/db/operators";
import {
  events,
  eventPricingTiers,
  registrations,
  teams,
} from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";

type ValidationSuccess = {
  event: typeof events.$inferSelect;
  error?: undefined;
  status?: undefined;
};

type ValidationError = {
  event?: undefined;
  error: string;
  status: number;
};

async function validateRegistrationOpen(
  eventId: string
): Promise<ValidationSuccess | ValidationError> {
  const db = getDb();

  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .then((rows) => rows[0] ?? null);

  if (!event) {
    return { error: "Event not found", status: 404 };
  }

  if (event.status !== "published" && event.status !== "registration_open") {
    return { error: "Registration is not open for this event", status: 400 };
  }

  const now = new Date();

  if (event.registrationOpenDate && now < event.registrationOpenDate) {
    return { error: "Registration has not opened yet", status: 400 };
  }

  if (event.registrationCloseDate && now > event.registrationCloseDate) {
    return { error: "Registration has closed", status: 400 };
  }

  if (event.maxParticipants) {
    const [result] = await db
      .select({ count: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, eventId),
          eq(registrations.status, "confirmed")
        )
      );

    if (result && result.count >= event.maxParticipants) {
      return { error: "Event is at full capacity", status: 400 };
    }
  }

  return { event };
}

function resolvePrice(tier: typeof eventPricingTiers.$inferSelect): number {
  if (
    tier.earlyBirdPriceInCents !== null &&
    tier.earlyBirdDeadline !== null &&
    new Date() < tier.earlyBirdDeadline
  ) {
    return tier.earlyBirdPriceInCents;
  }
  return tier.priceInCents;
}

export const registrationRoutes = new Elysia({ prefix: "/registrations" })
  .use(authMiddleware)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })

  // POST /individual
  .post(
    "/individual",
    async ({ user, body }) => {
      const db = getDb();

      const validation = await validateRegistrationOpen(body.eventId);
      if (validation.error) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const event = validation.event!;
      let amountInCents = 0;

      if (body.pricingTierId) {
        const tier = await db
          .select()
          .from(eventPricingTiers)
          .where(eq(eventPricingTiers.id, body.pricingTierId))
          .then((rows) => rows[0] ?? null);

        if (!tier) {
          return new Response(
            JSON.stringify({ error: "Pricing tier not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        amountInCents = resolvePrice(tier);
      }

      const paymentStatus = amountInCents > 0 ? "pending" : "waived";
      const status = amountInCents > 0 ? "pending" : "confirmed";
      const waiverStatus = event.requireWaiver ? "pending" : "not_required";

      const registration = await db
        .insert(registrations)
        .values({
          eventId: body.eventId,
          userId: user?.id ?? null,
          registrationType: "individual",
          participantName: body.participantName,
          participantEmail: body.participantEmail ?? "",
          participantDateOfBirth: body.participantDateOfBirth ?? null,
          participantRank: body.participantRank ?? null,
          participantFederation: body.participantFederation ?? null,
          participantDojoName: body.participantDojoName ?? null,
          pricingTierId: body.pricingTierId ?? null,
          amountPaidInCents: amountInCents,
          paymentStatus,
          waiverStatus,
          status,
          formResponses: body.formResponses ?? null,
        })
        .returning()
        .then((rows) => rows[0]);

      return registration;
    },
    {
      body: t.Object({
        eventId: t.String(),
        participantName: t.String(),
        participantEmail: t.Optional(t.String()),
        participantDateOfBirth: t.Optional(t.String()),
        participantRank: t.Optional(t.String()),
        participantFederation: t.Optional(t.String()),
        participantDojoName: t.Optional(t.String()),
        pricingTierId: t.Optional(t.String()),
        formResponses: t.Optional(t.Any()),
      }),
    }
  )

  // POST /team
  .post(
    "/team",
    async ({ user, body }) => {
      const db = getDb();

      const validation = await validateRegistrationOpen(body.eventId);
      if (validation.error) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const event = validation.event!;

      if (!event.allowTeamRegistration) {
        return new Response(
          JSON.stringify({ error: "Team registration is not allowed for this event" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      let amountInCents = 0;

      if (body.pricingTierId) {
        const tier = await db
          .select()
          .from(eventPricingTiers)
          .where(eq(eventPricingTiers.id, body.pricingTierId))
          .then((rows) => rows[0] ?? null);

        if (!tier) {
          return new Response(
            JSON.stringify({ error: "Pricing tier not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        amountInCents = resolvePrice(tier);
      }

      const paymentStatus = amountInCents > 0 ? "pending" : "waived";
      const status = amountInCents > 0 ? "pending" : "confirmed";
      const waiverStatus = event.requireWaiver ? "pending" : "not_required";

      // Create team first
      const team = await db
        .insert(teams)
        .values({
          eventId: body.eventId,
          name: body.teamName,
          captainUserId: user?.id ?? "",
          dojoName: body.dojoName ?? null,
          maxMembers: body.maxMembers ?? 5,
        })
        .returning()
        .then((rows) => rows[0]);

      // Create captain registration
      const registration = await db
        .insert(registrations)
        .values({
          eventId: body.eventId,
          userId: user?.id ?? null,
          registrationType: "team",
          teamId: team.id,
          participantName: body.captainName,
          participantEmail: body.captainEmail ?? "",
          participantRank: body.captainRank ?? null,
          participantFederation: body.captainFederation ?? null,
          pricingTierId: body.pricingTierId ?? null,
          amountPaidInCents: amountInCents,
          paymentStatus,
          waiverStatus,
          status,
        })
        .returning()
        .then((rows) => rows[0]);

      return { team, registration };
    },
    {
      body: t.Object({
        eventId: t.String(),
        teamName: t.String(),
        dojoName: t.Optional(t.String()),
        maxMembers: t.Optional(t.Number()),
        captainName: t.String(),
        captainEmail: t.Optional(t.String()),
        captainRank: t.Optional(t.String()),
        captainFederation: t.Optional(t.String()),
        pricingTierId: t.Optional(t.String()),
      }),
    }
  )

  // POST /team/:teamId/join
  .post(
    "/team/:teamId/join",
    async ({ user, params, body }) => {
      const db = getDb();

      const team = await db
        .select()
        .from(teams)
        .where(eq(teams.id, params.teamId))
        .then((rows) => rows[0] ?? null);

      if (!team) {
        return new Response(
          JSON.stringify({ error: "Team not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (team.status === "withdrawn") {
        return new Response(
          JSON.stringify({ error: "Team has been withdrawn" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check team capacity
      const [memberCount] = await db
        .select({ count: count() })
        .from(registrations)
        .where(
          and(
            eq(registrations.teamId, params.teamId),
            eq(registrations.registrationType, "team")
          )
        );

      if (memberCount && memberCount.count >= team.maxMembers) {
        return new Response(
          JSON.stringify({ error: "Team is full" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const validation = await validateRegistrationOpen(team.eventId);
      if (validation.error) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const event = validation.event!;
      const waiverStatus = event.requireWaiver ? "pending" : "not_required";

      const registration = await db
        .insert(registrations)
        .values({
          eventId: team.eventId,
          userId: user?.id ?? null,
          registrationType: "team",
          teamId: params.teamId,
          participantName: body.participantName,
          participantEmail: body.participantEmail ?? "",
          participantRank: body.participantRank ?? null,
          paymentStatus: "waived",
          waiverStatus,
          status: "confirmed",
        })
        .returning()
        .then((rows) => rows[0]);

      return registration;
    },
    {
      body: t.Object({
        participantName: t.String(),
        participantEmail: t.Optional(t.String()),
        participantRank: t.Optional(t.String()),
      }),
    }
  )

  // POST /minor
  .post(
    "/minor",
    async ({ user, body }) => {
      const db = getDb();

      const validation = await validateRegistrationOpen(body.eventId);
      if (validation.error) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const event = validation.event!;

      if (!event.allowMinorRegistration) {
        return new Response(
          JSON.stringify({ error: "Minor registration is not allowed for this event" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      let amountInCents = 0;

      if (body.pricingTierId) {
        const tier = await db
          .select()
          .from(eventPricingTiers)
          .where(eq(eventPricingTiers.id, body.pricingTierId))
          .then((rows) => rows[0] ?? null);

        if (!tier) {
          return new Response(
            JSON.stringify({ error: "Pricing tier not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        amountInCents = resolvePrice(tier);
      }

      const paymentStatus = amountInCents > 0 ? "pending" : "waived";
      const status = amountInCents > 0 ? "pending" : "confirmed";

      const registration = await db
        .insert(registrations)
        .values({
          eventId: body.eventId,
          userId: user?.id ?? null,
          registrationType: "minor",
          participantName: body.participantName,
          participantEmail: "",
          participantDateOfBirth: body.participantDateOfBirth,
          participantRank: body.participantRank ?? null,
          participantDojoName: body.participantDojoName ?? null,
          isMinor: true,
          guardianName: body.guardianName,
          guardianEmail: body.guardianEmail,
          guardianPhone: body.guardianPhone ?? null,
          guardianUserId: user?.id ?? null,
          pricingTierId: body.pricingTierId ?? null,
          amountPaidInCents: amountInCents,
          paymentStatus,
          waiverStatus: "pending",
          status,
          formResponses: body.formResponses ?? null,
        })
        .returning()
        .then((rows) => rows[0]);

      return registration;
    },
    {
      body: t.Object({
        eventId: t.String(),
        participantName: t.String(),
        participantDateOfBirth: t.String(),
        participantRank: t.Optional(t.String()),
        participantDojoName: t.Optional(t.String()),
        guardianName: t.String(),
        guardianEmail: t.String(),
        guardianPhone: t.Optional(t.String()),
        pricingTierId: t.Optional(t.String()),
        formResponses: t.Optional(t.Any()),
      }),
    }
  )

  // GET /:registrationId
  .get("/:registrationId", async ({ user, params }) => {
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    const registration = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, params.registrationId))
      .then((rows) => rows[0] ?? null);

    if (!registration) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return registration;
  })

  // POST /:registrationId/check-in
  .post("/:registrationId/check-in", async ({ user, params }) => {
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    const registration = await db
      .update(registrations)
      .set({
        status: "checked_in",
        checkedInAt: new Date(),
      })
      .where(eq(registrations.id, params.registrationId))
      .returning()
      .then((rows) => rows[0] ?? null);

    if (!registration) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return registration;
  })

  // GET /event/:dojoId/:eventId
  .get("/event/:dojoId/:eventId", async ({ user, params }) => {
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    const eventList = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, params.eventId));

    return eventList;
  });
