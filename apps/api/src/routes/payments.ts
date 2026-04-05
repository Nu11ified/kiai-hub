import { Elysia, t } from "elysia";
import Stripe from "stripe";
import { eq } from "@kiai-hub/db/operators";
import { registrations, events, dojos } from "@kiai-hub/db/schema";
import { PLATFORM_FEE_PERCENT } from "@kiai-hub/shared";
import { getDb } from "../lib/db.js";
import { getEnv } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";

function getStripe(): Stripe {
  return new Stripe(getEnv("STRIPE_SECRET_KEY"));
}

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  .use(requireAuth)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })

  // POST /create-intent
  .post(
    "/create-intent",
    async ({ body }) => {
      const db = getDb();
      const stripe = getStripe();

      const registration = await db
        .select()
        .from(registrations)
        .where(eq(registrations.id, body.registrationId))
        .then((rows) => rows[0] ?? null);

      if (!registration) {
        return new Response(
          JSON.stringify({ error: "Registration not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!registration.amountPaidInCents || registration.amountPaidInCents <= 0) {
        return new Response(
          JSON.stringify({ error: "No payment required for this registration" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const event = await db
        .select()
        .from(events)
        .where(eq(events.id, registration.eventId))
        .then((rows) => rows[0] ?? null);

      if (!event) {
        return new Response(
          JSON.stringify({ error: "Event not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const dojo = await db
        .select()
        .from(dojos)
        .where(eq(dojos.id, event.dojoId))
        .then((rows) => rows[0] ?? null);

      if (!dojo) {
        return new Response(
          JSON.stringify({ error: "Dojo not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const amount = registration.amountPaidInCents;
      const platformFee = Math.round(
        (amount * PLATFORM_FEE_PERCENT) / 100
      );

      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: event.currency.toLowerCase(),
        metadata: {
          registrationId: registration.id,
          eventId: event.id,
        },
      };

      if (dojo.stripeConnectId) {
        intentParams.application_fee_amount = platformFee;
        intentParams.transfer_data = {
          destination: dojo.stripeConnectId,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(intentParams);

      await db
        .update(registrations)
        .set({ stripePaymentIntentId: paymentIntent.id })
        .where(eq(registrations.id, registration.id));

      return {
        clientSecret: paymentIntent.client_secret,
        amount,
        currency: event.currency,
      };
    },
    {
      body: t.Object({
        registrationId: t.String(),
      }),
    }
  )

  // GET /receipt/:registrationId
  .get("/receipt/:registrationId", async ({ params }) => {
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

    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, registration.eventId))
      .then((rows) => rows[0] ?? null);

    return {
      registration,
      event,
      payment: {
        amount: registration.amountPaidInCents,
        status: registration.paymentStatus,
        stripePaymentIntentId: registration.stripePaymentIntentId,
      },
    };
  });

// Webhook route — separate, no auth, raw body
export const paymentWebhookRoute = new Elysia({ prefix: "/payments" })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })

  // POST /webhook
  .post("/webhook", async ({ request }) => {
    const stripe = getStripe();
    const db = getDb();

    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        getEnv("STRIPE_WEBHOOK_SECRET")
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await db
        .update(registrations)
        .set({
          paymentStatus: "paid",
          status: "confirmed",
        })
        .where(eq(registrations.stripePaymentIntentId, paymentIntent.id));
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await db
        .update(registrations)
        .set({
          paymentStatus: "failed",
        })
        .where(eq(registrations.stripePaymentIntentId, paymentIntent.id));
    }

    return { received: true };
  });
