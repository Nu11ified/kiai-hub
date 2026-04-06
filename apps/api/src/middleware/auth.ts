import { Elysia } from "elysia";
import { getAuth } from "../lib/auth.js";

export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  });

export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authMiddleware)
  .derive({ as: "scoped" }, ({ user }) => {
    if (!user) {
      throw new Error("Unauthorized");
    }
    return { user: user! };
  })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN" && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
