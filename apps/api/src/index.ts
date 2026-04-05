import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { dojoRoutes } from "./routes/dojos.js";
import { eventRoutes } from "./routes/events.js";
import { eventFormRoutes } from "./routes/event-forms.js";
import { eventPricingRoutes } from "./routes/event-pricing.js";
import { registrationRoutes } from "./routes/registrations.js";
import { paymentRoutes, paymentWebhookRoute } from "./routes/payments.js";

const app = new Elysia()
  .use(cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    credentials: true,
  }))
  .group("/api", (app) =>
    app
      .use(healthRoutes)
      .use(authRoutes)
      .use(userRoutes)
      .use(dojoRoutes)
      .use(eventRoutes)
      .use(eventFormRoutes)
      .use(eventPricingRoutes)
      .use(registrationRoutes)
      .use(paymentRoutes)
      .use(paymentWebhookRoute)
  );

export type App = typeof app;

export default {
  fetch: app.fetch,
};
