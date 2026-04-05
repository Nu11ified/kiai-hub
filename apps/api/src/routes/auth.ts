import { Elysia } from "elysia";
import { getAuth } from "../lib/auth.js";

export const authRoutes = new Elysia()
  .all("/auth/*", async ({ request }) => {
    const auth = getAuth();
    return auth.handler(request);
  });
