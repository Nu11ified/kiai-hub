# Phase 2: Dojos, Events & Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete API for dojo management, event creation, and participant registration with Stripe payments — plus the frontend dashboard to drive these flows.

**Architecture:** ElysiaJS route handlers in `apps/api/src/routes/` using Drizzle ORM queries against the existing schema. Session auth via Better Auth cookies. RBAC middleware checks dojo membership before mutating operations. Frontend is Next.js 15 App Router pages consuming the API via a typed fetch wrapper.

**Tech Stack:** ElysiaJS, Drizzle ORM, Better Auth, Stripe Connect, Resend, Next.js 15, Tailwind CSS 4

---

## File Map

### API — New Files

| File | Responsibility |
|------|---------------|
| `apps/api/src/lib/db.ts` | Creates and exports shared `db` instance from `DATABASE_URL` |
| `apps/api/src/lib/auth.ts` | Creates and exports shared `auth` instance |
| `apps/api/src/lib/env.ts` | Typed env access helper |
| `apps/api/src/middleware/auth.ts` | **Rewrite** — validate Better Auth session, derive `user` |
| `apps/api/src/middleware/dojo-access.ts` | Derive `dojoMember` with role, guard by permission |
| `apps/api/src/routes/auth.ts` | Mount Better Auth handler at `/api/auth/*` |
| `apps/api/src/routes/users.ts` | `GET/PATCH /api/users/me` |
| `apps/api/src/routes/dojos.ts` | Dojo CRUD + member management + ownership transfer |
| `apps/api/src/routes/events.ts` | Event CRUD + publish + dashboard stats |
| `apps/api/src/routes/event-forms.ts` | Custom form field CRUD under an event |
| `apps/api/src/routes/event-pricing.ts` | Pricing tier CRUD under an event |
| `apps/api/src/routes/registrations.ts` | Individual/team/minor registration + check-in |
| `apps/api/src/routes/payments.ts` | Stripe Connect onboard, create intent, webhook, receipt |

### API — Modified Files

| File | Change |
|------|--------|
| `apps/api/src/index.ts` | Mount all new route groups under `/api` |
| `apps/api/package.json` | Add `stripe` dependency |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `apps/web/lib/api.ts` | Typed API client (fetch wrapper) |
| `apps/web/app/(auth)/signin/page.tsx` | Sign-in form |
| `apps/web/app/(auth)/signup/page.tsx` | Sign-up form |
| `apps/web/app/(auth)/layout.tsx` | Centered card layout for auth pages |
| `apps/web/app/(dashboard)/layout.tsx` | Sidebar + topbar dashboard shell |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | Overview — list user's dojos |
| `apps/web/app/(dashboard)/dojos/new/page.tsx` | Create dojo form |
| `apps/web/app/(dashboard)/dojos/[dojoId]/settings/page.tsx` | Dojo settings |
| `apps/web/app/(dashboard)/dojos/[dojoId]/members/page.tsx` | Member list + invite |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/page.tsx` | Event list for dojo |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/new/page.tsx` | Create event form |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/page.tsx` | Event dashboard |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/registrations/page.tsx` | Registration list |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/pricing/page.tsx` | Pricing tiers |
| `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/forms/page.tsx` | Custom form builder |
| `apps/web/app/(public)/events/page.tsx` | Public event discovery |
| `apps/web/app/(public)/events/[slug]/page.tsx` | Public event detail |
| `apps/web/app/(public)/events/[slug]/register/page.tsx` | Public registration form |

### Packages — Modified Files

| File | Change |
|------|--------|
| `packages/shared/src/validators.ts` | Add registration, pricing tier, form field validators |
| `packages/shared/src/constants.ts` | Add `rankToIndex()` helper for bracket eligibility |
| `packages/email/src/templates/registration-confirmed.ts` | Registration confirmation HTML |
| `packages/email/src/templates/payment-receipt.ts` | Payment receipt HTML |

---

## Task 1: API Infrastructure — DB, Auth & Env Helpers

**Files:**
- Create: `apps/api/src/lib/env.ts`
- Create: `apps/api/src/lib/db.ts`
- Create: `apps/api/src/lib/auth.ts`

These are the shared singletons every route handler needs. On Cloudflare Workers, env vars come from the runtime — we read them from `process.env` (available with `nodejs_compat` flag).

- [ ] **Step 1: Create env helper**

```typescript
// apps/api/src/lib/env.ts
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}
```

- [ ] **Step 2: Create DB singleton**

```typescript
// apps/api/src/lib/db.ts
import { createDb } from "@kiai-hub/db";
import { getEnv } from "./env.js";

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb(getEnv("DATABASE_URL"));
  }
  return _db;
}
```

- [ ] **Step 3: Create auth singleton**

```typescript
// apps/api/src/lib/auth.ts
import { createAuth } from "@kiai-hub/auth";
import { getDb } from "./db.js";
import { getEnv } from "./env.js";

let _auth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!_auth) {
    _auth = createAuth({
      database: getDb(),
      secret: getEnv("BETTER_AUTH_SECRET"),
      baseURL: getEnv("BETTER_AUTH_URL"),
    });
  }
  return _auth;
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@kiai-hub/api`

---

## Task 2: Auth Middleware — Session Validation

**Files:**
- Rewrite: `apps/api/src/middleware/auth.ts`

Replace the placeholder with actual Better Auth session validation. This middleware derives a `user` object (or null) from the request cookies/headers.

- [ ] **Step 1: Rewrite auth middleware**

```typescript
// apps/api/src/middleware/auth.ts
import { Elysia } from "elysia";
import { getAuth } from "../lib/auth.js";

export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ request }) => {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  });

// Guard that requires authentication — use after authMiddleware
export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authMiddleware)
  .derive(({ user }) => {
    if (!user) {
      throw new Error("Unauthorized");
    }
    return { user: user! };
  })
  .onError(({ error }) => {
    if (error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@kiai-hub/api`

---

## Task 3: Dojo Access Middleware — RBAC

**Files:**
- Create: `apps/api/src/middleware/dojo-access.ts`

This middleware reads a `dojoId` param from the route, looks up the user's membership, and provides their role. Route handlers use this to enforce permissions.

- [ ] **Step 1: Create dojo access middleware**

```typescript
// apps/api/src/middleware/dojo-access.ts
import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { dojoMembers } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "./auth.js";

type DojoRole = "owner" | "admin" | "volunteer";

export const dojoAccess = new Elysia({ name: "dojoAccess" })
  .use(requireAuth)
  .derive(async ({ user, params }) => {
    const dojoId = (params as Record<string, string>).dojoId;
    if (!dojoId) throw new Error("Missing dojoId param");

    const db = getDb();
    const member = await db
      .select()
      .from(dojoMembers)
      .where(
        and(
          eq(dojoMembers.dojoId, dojoId),
          eq(dojoMembers.userId, user.id),
          eq(dojoMembers.inviteStatus, "accepted"),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!member) {
      throw new Error("Forbidden");
    }

    return {
      dojoMember: member,
      dojoRole: member.role as DojoRole,
    };
  })
  .onError(({ error }) => {
    if (error.message === "Forbidden") {
      return new Response(JSON.stringify({ error: "Not a member of this dojo" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });

/** Guard that requires owner or admin role */
export const requireDojoAdmin = new Elysia({ name: "requireDojoAdmin" })
  .use(dojoAccess)
  .derive(({ dojoRole }) => {
    if (dojoRole !== "owner" && dojoRole !== "admin") {
      throw new Error("AdminRequired");
    }
    return {};
  })
  .onError(({ error }) => {
    if (error.message === "AdminRequired") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });

/** Guard that requires owner role */
export const requireDojoOwner = new Elysia({ name: "requireDojoOwner" })
  .use(dojoAccess)
  .derive(({ dojoRole }) => {
    if (dojoRole !== "owner") {
      throw new Error("OwnerRequired");
    }
    return {};
  })
  .onError(({ error }) => {
    if (error.message === "OwnerRequired") {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@kiai-hub/api`

---

## Task 4: Auth Routes — Better Auth Handler

**Files:**
- Create: `apps/api/src/routes/auth.ts`

Mount Better Auth's built-in handler. This provides `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/session`, etc. — all handled by Better Auth.

- [ ] **Step 1: Create auth route handler**

```typescript
// apps/api/src/routes/auth.ts
import { Elysia } from "elysia";
import { getAuth } from "../lib/auth.js";

export const authRoutes = new Elysia()
  .all("/auth/*", async ({ request }) => {
    const auth = getAuth();
    return auth.handler(request);
  });
```

- [ ] **Step 2: Mount in index.ts**

Update `apps/api/src/index.ts` — add `import { authRoutes } from "./routes/auth.js"` and add `.use(authRoutes)` inside the `/api` group, before `healthRoutes`.

---

## Task 5: User Profile Routes

**Files:**
- Create: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Create user routes**

```typescript
// apps/api/src/routes/users.ts
import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { users } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(requireAuth)
  .get("/me", async ({ user }) => {
    const db = getDb();
    const profile = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .then((rows) => rows[0] ?? null);

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    return profile;
  })
  .patch("/me", async ({ user, body }) => {
    const db = getDb();
    const updated = await db
      .update(users)
      .set({
        name: body.name,
        dateOfBirth: body.dateOfBirth,
        phone: body.phone,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        kendoRank: body.kendoRank,
        yearsExperience: body.yearsExperience,
        federation: body.federation,
      })
      .where(eq(users.id, user.id))
      .returning()
      .then((rows) => rows[0]);

    return updated;
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      dateOfBirth: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      emergencyContactName: t.Optional(t.String()),
      emergencyContactPhone: t.Optional(t.String()),
      kendoRank: t.Optional(t.String()),
      yearsExperience: t.Optional(t.Number()),
      federation: t.Optional(t.String()),
    }),
  });
```

- [ ] **Step 2: Mount in index.ts**

Add `.use(userRoutes)` to the `/api` group in `apps/api/src/index.ts`.

---

## Task 6: Dojo CRUD Routes

**Files:**
- Create: `apps/api/src/routes/dojos.ts`

This is the largest route file. It handles dojo CRUD, member management, and ownership transfer — all in one file since they share the same URL prefix and middleware.

- [ ] **Step 1: Create dojo routes — CRUD**

```typescript
// apps/api/src/routes/dojos.ts
import { Elysia, t } from "elysia";
import { eq, and, desc } from "drizzle-orm";
import { dojos, dojoMembers, ownershipTransfers, users } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess, requireDojoAdmin, requireDojoOwner } from "../middleware/dojo-access.js";

export const dojoRoutes = new Elysia({ prefix: "/dojos" })
  // === Public-ish (auth required, no dojo membership needed) ===
  .use(requireAuth)

  // Create a new dojo — caller becomes owner
  .post("/", async ({ user, body }) => {
    const db = getDb();
    const [dojo] = await db.insert(dojos).values({
      name: body.name,
      slug: body.slug,
      description: body.description,
      federation: body.federation,
      contactEmail: body.contactEmail,
      timezone: body.timezone,
      website: body.website,
    }).returning();

    // Make creator the owner
    await db.insert(dojoMembers).values({
      dojoId: dojo.id,
      userId: user.id,
      role: "owner",
      inviteStatus: "accepted",
    });

    return dojo;
  }, {
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 100 }),
      slug: t.String({ minLength: 3, maxLength: 50, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
      description: t.Optional(t.String({ maxLength: 1000 })),
      federation: t.Optional(t.String()),
      contactEmail: t.Optional(t.String({ format: "email" })),
      timezone: t.Optional(t.String()),
      website: t.Optional(t.String()),
    }),
  })

  // List dojos the current user is a member of
  .get("/", async ({ user }) => {
    const db = getDb();
    const memberships = await db
      .select({
        dojo: dojos,
        role: dojoMembers.role,
      })
      .from(dojoMembers)
      .innerJoin(dojos, eq(dojos.id, dojoMembers.dojoId))
      .where(
        and(
          eq(dojoMembers.userId, user.id),
          eq(dojoMembers.inviteStatus, "accepted"),
        ),
      )
      .orderBy(desc(dojos.createdAt));

    return memberships;
  })

  // === Dojo-scoped routes (require membership) ===

  // Get dojo details
  .group("/:dojoId", (app) =>
    app
      .use(dojoAccess)
      .get("/", async ({ params }) => {
        const db = getDb();
        const dojo = await db
          .select()
          .from(dojos)
          .where(eq(dojos.id, params.dojoId))
          .then((rows) => rows[0] ?? null);

        if (!dojo) {
          return new Response(JSON.stringify({ error: "Dojo not found" }), { status: 404 });
        }
        return dojo;
      })

      // Update dojo (admin+)
      .patch("/", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();
        const [updated] = await db
          .update(dojos)
          .set(body)
          .where(eq(dojos.id, params.dojoId))
          .returning();
        return updated;
      }, {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
          description: t.Optional(t.String({ maxLength: 1000 })),
          federation: t.Optional(t.String()),
          contactEmail: t.Optional(t.String({ format: "email" })),
          timezone: t.Optional(t.String()),
          website: t.Optional(t.String()),
        }),
      })

      // Delete dojo (owner only)
      .delete("/", async ({ params, dojoRole }) => {
        if (dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), { status: 403 });
        }
        const db = getDb();
        await db.delete(dojos).where(eq(dojos.id, params.dojoId));
        return { success: true };
      })

      // --- Members ---

      .get("/members", async ({ params }) => {
        const db = getDb();
        const members = await db
          .select({
            id: dojoMembers.id,
            role: dojoMembers.role,
            inviteStatus: dojoMembers.inviteStatus,
            createdAt: dojoMembers.createdAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(dojoMembers)
          .innerJoin(users, eq(users.id, dojoMembers.userId))
          .where(eq(dojoMembers.dojoId, params.dojoId));

        return members;
      })

      .post("/invite", async ({ params, body, user, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }

        const db = getDb();

        // Find invited user by email
        const invitee = await db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .then((rows) => rows[0] ?? null);

        if (!invitee) {
          return new Response(JSON.stringify({ error: "User not found with that email" }), { status: 404 });
        }

        // Check not already a member
        const existing = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, invitee.id),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          return new Response(JSON.stringify({ error: "User is already a member" }), { status: 409 });
        }

        const [member] = await db.insert(dojoMembers).values({
          dojoId: params.dojoId,
          userId: invitee.id,
          role: body.role ?? "volunteer",
          invitedBy: user.id,
          inviteStatus: "pending",
        }).returning();

        // TODO: Send invite email via @kiai-hub/email

        return member;
      }, {
        body: t.Object({
          email: t.String({ format: "email" }),
          role: t.Optional(t.Union([
            t.Literal("admin"),
            t.Literal("volunteer"),
          ])),
        }),
      })

      // Update member role (admin+, can't change owner)
      .patch("/members/:memberId", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();

        const target = await db
          .select()
          .from(dojoMembers)
          .where(eq(dojoMembers.id, params.memberId))
          .then((rows) => rows[0] ?? null);

        if (!target || target.dojoId !== params.dojoId) {
          return new Response(JSON.stringify({ error: "Member not found" }), { status: 404 });
        }

        if (target.role === "owner") {
          return new Response(JSON.stringify({ error: "Cannot change owner role directly. Use ownership transfer." }), { status: 400 });
        }

        // Only owner can promote to admin
        if (body.role === "admin" && dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Only owners can promote to admin" }), { status: 403 });
        }

        const [updated] = await db
          .update(dojoMembers)
          .set({ role: body.role })
          .where(eq(dojoMembers.id, params.memberId))
          .returning();

        return updated;
      }, {
        body: t.Object({
          role: t.Union([t.Literal("admin"), t.Literal("volunteer")]),
        }),
      })

      // Remove member (admin+, can't remove owner)
      .delete("/members/:memberId", async ({ params, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();

        const target = await db
          .select()
          .from(dojoMembers)
          .where(eq(dojoMembers.id, params.memberId))
          .then((rows) => rows[0] ?? null);

        if (!target || target.dojoId !== params.dojoId) {
          return new Response(JSON.stringify({ error: "Member not found" }), { status: 404 });
        }

        if (target.role === "owner") {
          return new Response(JSON.stringify({ error: "Cannot remove the owner" }), { status: 400 });
        }

        await db.delete(dojoMembers).where(eq(dojoMembers.id, params.memberId));
        return { success: true };
      })

      // --- Ownership Transfer ---

      .post("/transfer-ownership", async ({ params, body, user, dojoRole }) => {
        if (dojoRole !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), { status: 403 });
        }

        const db = getDb();

        // Verify target is an admin in this dojo
        const targetMember = await db
          .select()
          .from(dojoMembers)
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, body.toUserId),
              eq(dojoMembers.inviteStatus, "accepted"),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!targetMember || targetMember.role !== "admin") {
          return new Response(JSON.stringify({ error: "Target must be an admin of this dojo" }), { status: 400 });
        }

        // Cancel any existing pending transfer
        await db
          .update(ownershipTransfers)
          .set({ status: "cancelled", resolvedAt: new Date() })
          .where(
            and(
              eq(ownershipTransfers.dojoId, params.dojoId),
              eq(ownershipTransfers.status, "pending"),
            ),
          );

        const [transfer] = await db.insert(ownershipTransfers).values({
          dojoId: params.dojoId,
          fromUserId: user.id,
          toUserId: body.toUserId,
        }).returning();

        // TODO: Send ownership transfer email

        return transfer;
      }, {
        body: t.Object({
          toUserId: t.String(),
        }),
      })

      .post("/transfer-ownership/:transferId/accept", async ({ params, user }) => {
        const db = getDb();

        const transfer = await db
          .select()
          .from(ownershipTransfers)
          .where(eq(ownershipTransfers.id, params.transferId))
          .then((rows) => rows[0] ?? null);

        if (!transfer || transfer.dojoId !== params.dojoId) {
          return new Response(JSON.stringify({ error: "Transfer not found" }), { status: 404 });
        }
        if (transfer.toUserId !== user.id) {
          return new Response(JSON.stringify({ error: "Not the transfer target" }), { status: 403 });
        }
        if (transfer.status !== "pending") {
          return new Response(JSON.stringify({ error: "Transfer is no longer pending" }), { status: 400 });
        }

        // Swap roles: old owner → admin, new owner → owner
        await db
          .update(dojoMembers)
          .set({ role: "admin" })
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, transfer.fromUserId),
            ),
          );

        await db
          .update(dojoMembers)
          .set({ role: "owner" })
          .where(
            and(
              eq(dojoMembers.dojoId, params.dojoId),
              eq(dojoMembers.userId, transfer.toUserId),
            ),
          );

        const [updated] = await db
          .update(ownershipTransfers)
          .set({ status: "accepted", resolvedAt: new Date() })
          .where(eq(ownershipTransfers.id, params.transferId))
          .returning();

        return updated;
      })

      .post("/transfer-ownership/:transferId/decline", async ({ params, user }) => {
        const db = getDb();

        const transfer = await db
          .select()
          .from(ownershipTransfers)
          .where(eq(ownershipTransfers.id, params.transferId))
          .then((rows) => rows[0] ?? null);

        if (!transfer || transfer.dojoId !== params.dojoId || transfer.toUserId !== user.id) {
          return new Response(JSON.stringify({ error: "Transfer not found" }), { status: 404 });
        }
        if (transfer.status !== "pending") {
          return new Response(JSON.stringify({ error: "Transfer is no longer pending" }), { status: 400 });
        }

        const [updated] = await db
          .update(ownershipTransfers)
          .set({ status: "declined", resolvedAt: new Date() })
          .where(eq(ownershipTransfers.id, params.transferId))
          .returning();

        return updated;
      })
  );
```

- [ ] **Step 2: Mount in index.ts**

Add `.use(dojoRoutes)` to the `/api` group.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@kiai-hub/api`

---

## Task 7: Event CRUD Routes

**Files:**
- Create: `apps/api/src/routes/events.ts`

Events belong to a dojo, so all mutation routes require dojo admin access. Public event listing doesn't require auth.

- [ ] **Step 1: Create event routes**

```typescript
// apps/api/src/routes/events.ts
import { Elysia, t } from "elysia";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { events, registrations, dojos } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const eventRoutes = new Elysia({ prefix: "/events" })
  // Public: list published events
  .get("/", async ({ query }) => {
    const db = getDb();
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const results = await db
      .select({
        event: events,
        dojoName: dojos.name,
        dojoSlug: dojos.slug,
      })
      .from(events)
      .innerJoin(dojos, eq(dojos.id, events.dojoId))
      .where(eq(events.visibility, "public"))
      .orderBy(desc(events.startDate))
      .limit(limit)
      .offset(offset);

    return results;
  })

  // Public: get event by dojo slug + event slug
  .get("/by-slug/:dojoSlug/:eventSlug", async ({ params }) => {
    const db = getDb();
    const dojo = await db
      .select()
      .from(dojos)
      .where(eq(dojos.slug, params.dojoSlug))
      .then((rows) => rows[0] ?? null);

    if (!dojo) {
      return new Response(JSON.stringify({ error: "Dojo not found" }), { status: 404 });
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
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });
    }

    return { ...event, dojo };
  })

  // Dojo-scoped event management
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)

      // List events for this dojo
      .get("/", async ({ params }) => {
        const db = getDb();
        return db
          .select()
          .from(events)
          .where(eq(events.dojoId, params.dojoId))
          .orderBy(desc(events.startDate));
      })

      // Create event (admin+)
      .post("/", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();
        const [event] = await db.insert(events).values({
          dojoId: params.dojoId,
          name: body.name,
          slug: body.slug,
          type: body.type,
          description: body.description,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          venueName: body.venueName,
          venueAddress: body.venueAddress,
          venueCity: body.venueCity,
          venueState: body.venueState,
          venueCountry: body.venueCountry,
          currency: body.currency ?? "USD",
          maxParticipants: body.maxParticipants,
          allowTeamRegistration: body.allowTeamRegistration,
          allowIndividualRegistration: body.allowIndividualRegistration,
          allowMinorRegistration: body.allowMinorRegistration,
          requireWaiver: body.requireWaiver,
        }).returning();

        return event;
      }, {
        body: t.Object({
          name: t.String({ minLength: 2, maxLength: 200 }),
          slug: t.String({ minLength: 3, maxLength: 50, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
          type: t.Union([
            t.Literal("taikai"), t.Literal("seminar"), t.Literal("shinsa"),
            t.Literal("gasshuku"), t.Literal("practice"), t.Literal("other"),
          ]),
          description: t.Optional(t.String({ maxLength: 5000 })),
          startDate: t.String(),
          endDate: t.String(),
          venueName: t.Optional(t.String()),
          venueAddress: t.Optional(t.String()),
          venueCity: t.Optional(t.String()),
          venueState: t.Optional(t.String()),
          venueCountry: t.Optional(t.String()),
          currency: t.Optional(t.String()),
          maxParticipants: t.Optional(t.Number({ minimum: 1 })),
          allowTeamRegistration: t.Optional(t.Boolean()),
          allowIndividualRegistration: t.Optional(t.Boolean()),
          allowMinorRegistration: t.Optional(t.Boolean()),
          requireWaiver: t.Optional(t.Boolean()),
        }),
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
          return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });
        }
        return event;
      })

      // Update event (admin+)
      .patch("/:eventId", async ({ params, body, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();

        const updateData: Record<string, any> = { ...body };
        if (body.startDate) updateData.startDate = new Date(body.startDate);
        if (body.endDate) updateData.endDate = new Date(body.endDate);
        if (body.registrationOpenDate) updateData.registrationOpenDate = new Date(body.registrationOpenDate);
        if (body.registrationCloseDate) updateData.registrationCloseDate = new Date(body.registrationCloseDate);

        const [updated] = await db
          .update(events)
          .set(updateData)
          .where(
            and(
              eq(events.id, params.eventId),
              eq(events.dojoId, params.dojoId),
            ),
          )
          .returning();

        return updated;
      }, {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
          description: t.Optional(t.String({ maxLength: 5000 })),
          startDate: t.Optional(t.String()),
          endDate: t.Optional(t.String()),
          registrationOpenDate: t.Optional(t.String()),
          registrationCloseDate: t.Optional(t.String()),
          venueName: t.Optional(t.String()),
          venueAddress: t.Optional(t.String()),
          venueCity: t.Optional(t.String()),
          venueState: t.Optional(t.String()),
          venueCountry: t.Optional(t.String()),
          visibility: t.Optional(t.Union([
            t.Literal("public"), t.Literal("private"), t.Literal("unlisted"),
          ])),
          maxParticipants: t.Optional(t.Number({ minimum: 1 })),
          allowTeamRegistration: t.Optional(t.Boolean()),
          allowIndividualRegistration: t.Optional(t.Boolean()),
          allowMinorRegistration: t.Optional(t.Boolean()),
          requireWaiver: t.Optional(t.Boolean()),
        }),
      })

      // Delete event (admin+)
      .delete("/:eventId", async ({ params, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
        const db = getDb();
        await db.delete(events).where(
          and(
            eq(events.id, params.eventId),
            eq(events.dojoId, params.dojoId),
          ),
        );
        return { success: true };
      })

      // Publish event — transitions from draft to published
      .post("/:eventId/publish", async ({ params, dojoRole }) => {
        if (dojoRole === "volunteer") {
          return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
        }
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
          return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });
        }
        if (event.status !== "draft") {
          return new Response(JSON.stringify({ error: "Only draft events can be published" }), { status: 400 });
        }

        const [updated] = await db
          .update(events)
          .set({ status: "published" })
          .where(eq(events.id, params.eventId))
          .returning();

        return updated;
      })

      // Event dashboard stats
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
          return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });
        }

        const [regCount] = await db
          .select({ count: count() })
          .from(registrations)
          .where(eq(registrations.eventId, params.eventId));

        const [paidCount] = await db
          .select({ count: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.eventId, params.eventId),
              eq(registrations.paymentStatus, "paid"),
            ),
          );

        const [revenueResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${registrations.amountPaidInCents}), 0)`,
          })
          .from(registrations)
          .where(
            and(
              eq(registrations.eventId, params.eventId),
              eq(registrations.paymentStatus, "paid"),
            ),
          );

        return {
          event,
          stats: {
            totalRegistrations: regCount.count,
            paidRegistrations: paidCount.count,
            totalRevenueCents: revenueResult.total,
          },
        };
      })
  );
```

- [ ] **Step 2: Mount in index.ts and verify typecheck**

---

## Task 8: Event Forms & Pricing Routes

**Files:**
- Create: `apps/api/src/routes/event-forms.ts`
- Create: `apps/api/src/routes/event-pricing.ts`

- [ ] **Step 1: Create custom form field routes**

```typescript
// apps/api/src/routes/event-forms.ts
import { Elysia, t } from "elysia";
import { eq, and, asc } from "drizzle-orm";
import { customFormFields } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const eventFormRoutes = new Elysia({ prefix: "/events/dojo/:dojoId/:eventId/forms" })
  .use(dojoAccess)

  .get("/", async ({ params }) => {
    const db = getDb();
    return db
      .select()
      .from(customFormFields)
      .where(eq(customFormFields.eventId, params.eventId))
      .orderBy(asc(customFormFields.sortOrder));
  })

  .post("/", async ({ params, body, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();
    const [field] = await db.insert(customFormFields).values({
      eventId: params.eventId,
      label: body.label,
      type: body.type,
      options: body.options,
      required: body.required,
      placeholder: body.placeholder,
      helpText: body.helpText,
      sortOrder: body.sortOrder ?? 0,
      section: body.section,
    }).returning();
    return field;
  }, {
    body: t.Object({
      label: t.String({ minLength: 1 }),
      type: t.Union([
        t.Literal("text"), t.Literal("textarea"), t.Literal("select"),
        t.Literal("multiselect"), t.Literal("checkbox"), t.Literal("radio"),
        t.Literal("date"), t.Literal("file"), t.Literal("number"),
      ]),
      options: t.Optional(t.Any()),
      required: t.Optional(t.Boolean()),
      placeholder: t.Optional(t.String()),
      helpText: t.Optional(t.String()),
      sortOrder: t.Optional(t.Number()),
      section: t.Optional(t.String()),
    }),
  })

  .patch("/:fieldId", async ({ params, body, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();
    const [updated] = await db
      .update(customFormFields)
      .set(body)
      .where(
        and(
          eq(customFormFields.id, params.fieldId),
          eq(customFormFields.eventId, params.eventId),
        ),
      )
      .returning();
    return updated;
  }, {
    body: t.Object({
      label: t.Optional(t.String()),
      type: t.Optional(t.String()),
      options: t.Optional(t.Any()),
      required: t.Optional(t.Boolean()),
      placeholder: t.Optional(t.String()),
      helpText: t.Optional(t.String()),
      sortOrder: t.Optional(t.Number()),
      section: t.Optional(t.String()),
    }),
  })

  .delete("/:fieldId", async ({ params, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();
    await db.delete(customFormFields).where(
      and(
        eq(customFormFields.id, params.fieldId),
        eq(customFormFields.eventId, params.eventId),
      ),
    );
    return { success: true };
  });
```

- [ ] **Step 2: Create pricing tier routes**

```typescript
// apps/api/src/routes/event-pricing.ts
import { Elysia, t } from "elysia";
import { eq, and, asc } from "drizzle-orm";
import { eventPricingTiers } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const eventPricingRoutes = new Elysia({ prefix: "/events/dojo/:dojoId/:eventId/pricing" })
  .use(dojoAccess)

  .get("/", async ({ params }) => {
    const db = getDb();
    return db
      .select()
      .from(eventPricingTiers)
      .where(eq(eventPricingTiers.eventId, params.eventId))
      .orderBy(asc(eventPricingTiers.sortOrder));
  })

  .post("/", async ({ params, body, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();
    const [tier] = await db.insert(eventPricingTiers).values({
      eventId: params.eventId,
      name: body.name,
      description: body.description,
      priceInCents: body.priceInCents,
      maxQuantity: body.maxQuantity,
      applicableTo: body.applicableTo ?? "individual",
      earlyBirdPriceInCents: body.earlyBirdPriceInCents,
      earlyBirdDeadline: body.earlyBirdDeadline ? new Date(body.earlyBirdDeadline) : undefined,
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    return tier;
  }, {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      description: t.Optional(t.String()),
      priceInCents: t.Number({ minimum: 0 }),
      maxQuantity: t.Optional(t.Number({ minimum: 1 })),
      applicableTo: t.Optional(t.Union([
        t.Literal("individual"), t.Literal("team"), t.Literal("both"),
      ])),
      earlyBirdPriceInCents: t.Optional(t.Number({ minimum: 0 })),
      earlyBirdDeadline: t.Optional(t.String()),
      sortOrder: t.Optional(t.Number()),
    }),
  })

  .patch("/:tierId", async ({ params, body, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();

    const updateData: Record<string, any> = { ...body };
    if (body.earlyBirdDeadline) updateData.earlyBirdDeadline = new Date(body.earlyBirdDeadline);

    const [updated] = await db
      .update(eventPricingTiers)
      .set(updateData)
      .where(
        and(
          eq(eventPricingTiers.id, params.tierId),
          eq(eventPricingTiers.eventId, params.eventId),
        ),
      )
      .returning();
    return updated;
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      description: t.Optional(t.String()),
      priceInCents: t.Optional(t.Number({ minimum: 0 })),
      maxQuantity: t.Optional(t.Number({ minimum: 1 })),
      applicableTo: t.Optional(t.String()),
      earlyBirdPriceInCents: t.Optional(t.Number({ minimum: 0 })),
      earlyBirdDeadline: t.Optional(t.String()),
      sortOrder: t.Optional(t.Number()),
    }),
  })

  .delete("/:tierId", async ({ params, dojoRole }) => {
    if (dojoRole === "volunteer") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
    }
    const db = getDb();
    await db.delete(eventPricingTiers).where(
      and(
        eq(eventPricingTiers.id, params.tierId),
        eq(eventPricingTiers.eventId, params.eventId),
      ),
    );
    return { success: true };
  });
```

- [ ] **Step 3: Mount both in index.ts and verify typecheck**

---

## Task 9: Registration Routes

**Files:**
- Create: `apps/api/src/routes/registrations.ts`

Registration is public-facing (anyone can register) but reading registrations requires dojo membership. This is the most complex route file — it handles individual, team, minor, and join-team flows.

- [ ] **Step 1: Create registration routes**

```typescript
// apps/api/src/routes/registrations.ts
import { Elysia, t } from "elysia";
import { eq, and, count } from "drizzle-orm";
import { registrations, events, teams, eventPricingTiers } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { dojoAccess } from "../middleware/dojo-access.js";

// Helper to check if registration is open
async function validateRegistrationOpen(eventId: string) {
  const db = getDb();
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .then((rows) => rows[0] ?? null);

  if (!event) return { error: "Event not found", status: 404 as const };

  const now = new Date();
  const regOpen = event.registrationOpenDate ? new Date(event.registrationOpenDate) <= now : true;
  const regClosed = event.registrationCloseDate ? new Date(event.registrationCloseDate) < now : false;

  if (!["published", "registration_open"].includes(event.status) || !regOpen || regClosed) {
    return { error: "Registration is not open", status: 400 as const };
  }

  if (event.maxParticipants) {
    const [{ count: regCount }] = await db
      .select({ count: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, eventId),
          eq(registrations.status, "confirmed"),
        ),
      );
    if (regCount >= event.maxParticipants) {
      return { error: "Event is full", status: 400 as const };
    }
  }

  return { event };
}

// Helper to resolve the effective price in cents
function resolvePrice(tier: typeof eventPricingTiers.$inferSelect): number {
  if (tier.earlyBirdPriceInCents != null && tier.earlyBirdDeadline) {
    if (new Date() < new Date(tier.earlyBirdDeadline)) {
      return tier.earlyBirdPriceInCents;
    }
  }
  return tier.priceInCents;
}

export const registrationRoutes = new Elysia({ prefix: "/registrations" })
  // --- Public registration endpoints (auth optional but recommended) ---

  .use(authMiddleware)

  // Individual registration
  .post("/individual", async ({ user, body }) => {
    const validation = await validateRegistrationOpen(body.eventId);
    if ("error" in validation) {
      return new Response(JSON.stringify({ error: validation.error }), { status: validation.status });
    }

    const db = getDb();

    // Resolve pricing tier
    let amountCents = 0;
    if (body.pricingTierId) {
      const tier = await db
        .select()
        .from(eventPricingTiers)
        .where(eq(eventPricingTiers.id, body.pricingTierId))
        .then((rows) => rows[0] ?? null);
      if (!tier) {
        return new Response(JSON.stringify({ error: "Pricing tier not found" }), { status: 400 });
      }
      amountCents = resolvePrice(tier);
    }

    const [registration] = await db.insert(registrations).values({
      eventId: body.eventId,
      userId: user?.id ?? null,
      registrationType: "individual",
      participantName: body.participantName,
      participantEmail: body.participantEmail,
      participantDateOfBirth: body.participantDateOfBirth,
      participantRank: body.participantRank,
      participantFederation: body.participantFederation,
      participantDojoName: body.participantDojoName,
      pricingTierId: body.pricingTierId,
      amountPaidInCents: amountCents,
      paymentStatus: amountCents > 0 ? "pending" : "waived",
      waiverStatus: validation.event.requireWaiver ? "pending" : "not_required",
      formResponses: body.formResponses,
      status: amountCents > 0 ? "pending" : "confirmed",
    }).returning();

    return registration;
  }, {
    body: t.Object({
      eventId: t.String(),
      participantName: t.String({ minLength: 1 }),
      participantEmail: t.Optional(t.String({ format: "email" })),
      participantDateOfBirth: t.Optional(t.String()),
      participantRank: t.Optional(t.String()),
      participantFederation: t.Optional(t.String()),
      participantDojoName: t.Optional(t.String()),
      pricingTierId: t.Optional(t.String()),
      formResponses: t.Optional(t.Any()),
    }),
  })

  // Team registration — creates team + captain registration
  .post("/team", async ({ user, body }) => {
    const validation = await validateRegistrationOpen(body.eventId);
    if ("error" in validation) {
      return new Response(JSON.stringify({ error: validation.error }), { status: validation.status });
    }

    if (!validation.event.allowTeamRegistration) {
      return new Response(JSON.stringify({ error: "Team registration is not allowed" }), { status: 400 });
    }

    const db = getDb();

    // Create team
    const [team] = await db.insert(teams).values({
      eventId: body.eventId,
      name: body.teamName,
      captainUserId: user?.id ?? null,
      dojoName: body.dojoName,
      maxMembers: body.maxMembers ?? 5,
    }).returning();

    // Resolve pricing
    let amountCents = 0;
    if (body.pricingTierId) {
      const tier = await db
        .select()
        .from(eventPricingTiers)
        .where(eq(eventPricingTiers.id, body.pricingTierId))
        .then((rows) => rows[0] ?? null);
      if (tier) amountCents = resolvePrice(tier);
    }

    // Register captain
    const [registration] = await db.insert(registrations).values({
      eventId: body.eventId,
      userId: user?.id ?? null,
      registrationType: "team",
      teamId: team.id,
      participantName: body.captainName,
      participantEmail: body.captainEmail,
      participantRank: body.captainRank,
      participantFederation: body.captainFederation,
      participantDojoName: body.dojoName,
      pricingTierId: body.pricingTierId,
      amountPaidInCents: amountCents,
      paymentStatus: amountCents > 0 ? "pending" : "waived",
      waiverStatus: validation.event.requireWaiver ? "pending" : "not_required",
      status: amountCents > 0 ? "pending" : "confirmed",
    }).returning();

    return { team, registration };
  }, {
    body: t.Object({
      eventId: t.String(),
      teamName: t.String({ minLength: 1 }),
      dojoName: t.Optional(t.String()),
      maxMembers: t.Optional(t.Number({ minimum: 2 })),
      captainName: t.String({ minLength: 1 }),
      captainEmail: t.Optional(t.String({ format: "email" })),
      captainRank: t.Optional(t.String()),
      captainFederation: t.Optional(t.String()),
      pricingTierId: t.Optional(t.String()),
    }),
  })

  // Join existing team
  .post("/team/:teamId/join", async ({ user, params, body }) => {
    const db = getDb();

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, params.teamId))
      .then((rows) => rows[0] ?? null);

    if (!team || team.status === "withdrawn") {
      return new Response(JSON.stringify({ error: "Team not found" }), { status: 404 });
    }

    // Check team capacity
    const [{ count: memberCount }] = await db
      .select({ count: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.teamId, team.id),
          eq(registrations.status, "confirmed"),
        ),
      );

    if (team.maxMembers && memberCount >= team.maxMembers) {
      return new Response(JSON.stringify({ error: "Team is full" }), { status: 400 });
    }

    const validation = await validateRegistrationOpen(team.eventId);
    if ("error" in validation) {
      return new Response(JSON.stringify({ error: validation.error }), { status: validation.status });
    }

    const [registration] = await db.insert(registrations).values({
      eventId: team.eventId,
      userId: user?.id ?? null,
      registrationType: "team",
      teamId: team.id,
      participantName: body.participantName,
      participantEmail: body.participantEmail,
      participantRank: body.participantRank,
      participantDojoName: team.dojoName,
      paymentStatus: "waived",
      waiverStatus: validation.event.requireWaiver ? "pending" : "not_required",
      status: "confirmed",
    }).returning();

    return registration;
  }, {
    body: t.Object({
      participantName: t.String({ minLength: 1 }),
      participantEmail: t.Optional(t.String({ format: "email" })),
      participantRank: t.Optional(t.String()),
    }),
  })

  // Minor registration — requires guardian info
  .post("/minor", async ({ user, body }) => {
    const validation = await validateRegistrationOpen(body.eventId);
    if ("error" in validation) {
      return new Response(JSON.stringify({ error: validation.error }), { status: validation.status });
    }

    if (!validation.event.allowMinorRegistration) {
      return new Response(JSON.stringify({ error: "Minor registration is not allowed" }), { status: 400 });
    }

    const db = getDb();

    let amountCents = 0;
    if (body.pricingTierId) {
      const tier = await db
        .select()
        .from(eventPricingTiers)
        .where(eq(eventPricingTiers.id, body.pricingTierId))
        .then((rows) => rows[0] ?? null);
      if (tier) amountCents = resolvePrice(tier);
    }

    const [registration] = await db.insert(registrations).values({
      eventId: body.eventId,
      userId: user?.id ?? null,
      registrationType: "minor",
      participantName: body.participantName,
      participantDateOfBirth: body.participantDateOfBirth,
      participantRank: body.participantRank,
      participantDojoName: body.participantDojoName,
      isMinor: true,
      guardianName: body.guardianName,
      guardianEmail: body.guardianEmail,
      guardianPhone: body.guardianPhone,
      guardianUserId: user?.id ?? null,
      pricingTierId: body.pricingTierId,
      amountPaidInCents: amountCents,
      paymentStatus: amountCents > 0 ? "pending" : "waived",
      waiverStatus: "pending", // minors always need guardian waiver
      formResponses: body.formResponses,
      status: amountCents > 0 ? "pending" : "confirmed",
    }).returning();

    return registration;
  }, {
    body: t.Object({
      eventId: t.String(),
      participantName: t.String({ minLength: 1 }),
      participantDateOfBirth: t.String(),
      participantRank: t.Optional(t.String()),
      participantDojoName: t.Optional(t.String()),
      guardianName: t.String({ minLength: 1 }),
      guardianEmail: t.String({ format: "email" }),
      guardianPhone: t.Optional(t.String()),
      pricingTierId: t.Optional(t.String()),
      formResponses: t.Optional(t.Any()),
    }),
  })

  // --- Dojo-scoped management endpoints ---

  // Get registration by ID (auth required)
  .get("/:registrationId", async ({ params, user }) => {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const db = getDb();
    const reg = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, params.registrationId))
      .then((rows) => rows[0] ?? null);

    if (!reg) {
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404 });
    }
    return reg;
  })

  // Check in participant (dojo member needed — done via separate endpoint)
  .post("/:registrationId/check-in", async ({ params, user }) => {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const db = getDb();
    const [updated] = await db
      .update(registrations)
      .set({
        status: "checked_in",
        checkedInAt: new Date(),
      })
      .where(eq(registrations.id, params.registrationId))
      .returning();

    return updated;
  })

  // List registrations for an event (dojo-scoped)
  .get("/event/:dojoId/:eventId", async ({ params, user }) => {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const db = getDb();
    return db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, params.eventId));
  });
```

- [ ] **Step 2: Mount in index.ts and verify typecheck**

---

## Task 10: Payment Routes (Stripe Connect)

**Files:**
- Modify: `apps/api/package.json` — add `"stripe": "^17.0.0"`
- Create: `apps/api/src/routes/payments.ts`

- [ ] **Step 1: Add stripe dependency**

Run: `pnpm --filter @kiai-hub/api add stripe`

- [ ] **Step 2: Create payment routes**

```typescript
// apps/api/src/routes/payments.ts
import { Elysia, t } from "elysia";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { registrations, events, dojos, eventPricingTiers } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { getEnv } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";
import { PLATFORM_FEE_PERCENT } from "@kiai-hub/shared";

function getStripe() {
  return new Stripe(getEnv("STRIPE_SECRET_KEY"));
}

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  // Create payment intent for a registration
  .use(requireAuth)
  .post("/create-intent", async ({ body }) => {
    const db = getDb();
    const stripe = getStripe();

    const reg = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, body.registrationId))
      .then((rows) => rows[0] ?? null);

    if (!reg) {
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404 });
    }

    if (reg.paymentStatus === "paid") {
      return new Response(JSON.stringify({ error: "Already paid" }), { status: 400 });
    }

    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, reg.eventId))
      .then((rows) => rows[0]!);

    const dojo = await db
      .select()
      .from(dojos)
      .where(eq(dojos.id, event.dojoId))
      .then((rows) => rows[0]!);

    const amount = reg.amountPaidInCents ?? 0;
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "No payment required" }), { status: 400 });
    }

    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100));

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: event.currency ?? "usd",
      metadata: {
        registrationId: reg.id,
        eventId: event.id,
        dojoId: dojo.id,
      },
    };

    // If dojo has Stripe Connect, route payment through their account
    if (dojo.stripeConnectId) {
      intentParams.application_fee_amount = platformFee;
      intentParams.transfer_data = { destination: dojo.stripeConnectId };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    // Store the payment intent ID on the registration
    await db
      .update(registrations)
      .set({ stripePaymentIntentId: paymentIntent.id })
      .where(eq(registrations.id, reg.id));

    return {
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }, {
    body: t.Object({
      registrationId: t.String(),
    }),
  })

  // Get payment receipt
  .get("/receipt/:registrationId", async ({ params }) => {
    const db = getDb();
    const reg = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, params.registrationId))
      .then((rows) => rows[0] ?? null);

    if (!reg) {
      return new Response(JSON.stringify({ error: "Registration not found" }), { status: 404 });
    }

    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, reg.eventId))
      .then((rows) => rows[0]!);

    return {
      registration: reg,
      event: { name: event.name, startDate: event.startDate, venueName: event.venueName },
      payment: {
        amount: reg.amountPaidInCents,
        currency: event.currency,
        status: reg.paymentStatus,
        stripePaymentIntentId: reg.stripePaymentIntentId,
      },
    };
  });

// Webhook handler — mounted separately (no auth, raw body needed)
export const paymentWebhookRoute = new Elysia({ prefix: "/payments" })
  .post("/webhook", async ({ request }) => {
    const stripe = getStripe();
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        getEnv("STRIPE_WEBHOOK_SECRET"),
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const db = getDb();

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const registrationId = pi.metadata.registrationId;

      if (registrationId) {
        await db
          .update(registrations)
          .set({
            paymentStatus: "paid",
            status: "confirmed",
          })
          .where(eq(registrations.id, registrationId));

        // TODO: Send confirmation email + payment receipt email
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const registrationId = pi.metadata.registrationId;

      if (registrationId) {
        await db
          .update(registrations)
          .set({ paymentStatus: "failed" })
          .where(eq(registrations.id, registrationId));
      }
    }

    return { received: true };
  });
```

- [ ] **Step 3: Stripe Connect dojo onboarding endpoint**

Add to `apps/api/src/routes/dojos.ts` — after the transfer ownership block, still inside the `/:dojoId` group:

```typescript
// Inside the /:dojoId group in dojos.ts

// Stripe Connect onboarding (owner only)
.post("/stripe-connect", async ({ params, dojoRole }) => {
  if (dojoRole !== "owner") {
    return new Response(JSON.stringify({ error: "Owner access required" }), { status: 403 });
  }

  const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY!);
  const db = getDb();

  const dojo = await db
    .select()
    .from(dojos)
    .where(eq(dojos.id, params.dojoId))
    .then((rows) => rows[0]!);

  let accountId = dojo.stripeConnectId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { dojoId: params.dojoId },
    });
    accountId = account.id;

    await db
      .update(dojos)
      .set({
        stripeConnectId: accountId,
        payoutMethod: "stripe_connect",
      })
      .where(eq(dojos.id, params.dojoId));
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dojos/${params.dojoId}/settings?stripe=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dojos/${params.dojoId}/settings?stripe=complete`,
    type: "account_onboarding",
  });

  return { url: accountLink.url };
})
```

- [ ] **Step 4: Mount payment routes in index.ts and verify typecheck**

Mount both `paymentRoutes` (inside the auth-protected group) and `paymentWebhookRoute` (outside, no auth).

---

## Task 11: Wire All Routes in index.ts

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Update index.ts to mount all routes**

```typescript
// apps/api/src/index.ts
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
```

- [ ] **Step 2: Verify full typecheck**

Run: `pnpm turbo typecheck`

---

## Task 12: Email Templates

**Files:**
- Create: `packages/email/src/templates/registration-confirmed.ts`
- Create: `packages/email/src/templates/payment-receipt.ts`

- [ ] **Step 1: Create registration confirmation template**

```typescript
// packages/email/src/templates/registration-confirmed.ts
export function registrationConfirmedHtml(data: {
  participantName: string;
  eventName: string;
  eventDate: string;
  venueName?: string;
  registrationType: string;
  teamName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Registration Confirmed</h1>
  <p>Hi ${data.participantName},</p>
  <p>You're registered for <strong>${data.eventName}</strong>!</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 0; color: #666;">Event</td><td style="padding: 8px 0;">${data.eventName}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0;">${data.eventDate}</td></tr>
    ${data.venueName ? `<tr><td style="padding: 8px 0; color: #666;">Venue</td><td style="padding: 8px 0;">${data.venueName}</td></tr>` : ""}
    <tr><td style="padding: 8px 0; color: #666;">Type</td><td style="padding: 8px 0;">${data.registrationType}${data.teamName ? ` (${data.teamName})` : ""}</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">If you have questions, contact the event organizer.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
```

- [ ] **Step 2: Create payment receipt template**

```typescript
// packages/email/src/templates/payment-receipt.ts
export function paymentReceiptHtml(data: {
  participantName: string;
  eventName: string;
  amountFormatted: string;
  currency: string;
  paidAt: string;
  receiptUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Payment Receipt</h1>
  <p>Hi ${data.participantName},</p>
  <p>We've received your payment for <strong>${data.eventName}</strong>.</p>
  <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px; color: #666;">Amount Paid</p>
    <p style="margin: 0; font-size: 24px; font-weight: bold;">${data.amountFormatted} ${data.currency.toUpperCase()}</p>
    <p style="margin: 8px 0 0; color: #666; font-size: 14px;">Paid on ${data.paidAt}</p>
  </div>
  ${data.receiptUrl ? `<p><a href="${data.receiptUrl}" style="color: #2563eb;">View full receipt</a></p>` : ""}
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
```

- [ ] **Step 3: Export from package index**

Update `packages/email/src/index.ts` to add:

```typescript
export { registrationConfirmedHtml } from "./templates/registration-confirmed.js";
export { paymentReceiptHtml } from "./templates/payment-receipt.js";
```

---

## Task 13: Frontend API Client

**Files:**
- Create: `apps/web/lib/api.ts`

A typed fetch wrapper that handles auth cookies and base URL.

- [ ] **Step 1: Create API client**

```typescript
// apps/web/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, error.error || "Request failed");
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

- [ ] **Step 2: Add `NEXT_PUBLIC_API_URL` to .env.example**

---

## Task 14: Auth Pages

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/signin/page.tsx`
- Create: `apps/web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create auth layout**

```tsx
// apps/web/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create sign-in page**

```tsx
// apps/web/app/(auth)/signin/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Sign in failed");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign In</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{" "}
        <a href="/signup" className="font-medium text-gray-900 hover:underline">Sign up</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create sign-up page**

Same structure as sign-in but calls `/auth/sign-up/email` with `{ email, password, name }` fields. Redirects to `/dashboard` on success.

---

## Task 15: Dashboard Layout & Pages

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/new/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/settings/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/members/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/new/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/registrations/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/pricing/page.tsx`
- Create: `apps/web/app/(dashboard)/dojos/[dojoId]/events/[eventId]/forms/page.tsx`

This is a large task. Each page follows the same pattern: client component, fetch data from API, render with Tailwind. The dashboard layout provides the sidebar navigation.

- [ ] **Step 1: Create dashboard layout with sidebar**

```tsx
// apps/web/app/(dashboard)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-gray-50 p-4">
        <Link href="/dashboard" className="mb-8 block text-xl font-bold">
          Kiai Hub
        </Link>
        <nav className="space-y-1">
          <NavLink href="/dashboard" current={pathname === "/dashboard"}>
            Dashboard
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm font-medium ${
        current ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Create dashboard overview page**

Shows list of user's dojos with "Create Dojo" button. Fetches from `GET /api/dojos`.

- [ ] **Step 3: Create dojo creation page**

Form with name, slug (auto-generated from name), description, federation, contact email. Posts to `POST /api/dojos`.

- [ ] **Step 4: Create dojo settings page**

Fetches dojo details from `GET /api/dojos/:id`. Editable form that PATCHes. Includes Stripe Connect onboarding button if no `stripeConnectId`.

- [ ] **Step 5: Create members page**

Lists members from `GET /api/dojos/:id/members`. Invite form. Role change dropdown. Remove button. Shows pending invites.

- [ ] **Step 6: Create dojo events list page**

Lists events from `GET /api/events/dojo/:dojoId`. "Create Event" button. Shows status badges.

- [ ] **Step 7: Create event creation page**

Form wizard: name, slug, type (dropdown), dates, venue, registration settings. Posts to `POST /api/events/dojo/:dojoId`.

- [ ] **Step 8: Create event dashboard page**

Fetches from `GET /api/events/dojo/:dojoId/:eventId/dashboard`. Shows stats cards (registrations, revenue). Links to sub-pages (registrations, pricing, forms).

- [ ] **Step 9: Create registrations list page**

Table of registrations from `GET /api/registrations/event/:dojoId/:eventId`. Shows name, type, payment status, waiver status. Check-in button.

- [ ] **Step 10: Create pricing tiers page**

CRUD for pricing tiers. List with edit/delete. "Add Tier" form. Early bird toggle.

- [ ] **Step 11: Create custom forms page**

CRUD for form fields. Sortable list. Add field with type selector, options for select/radio, required toggle.

---

## Task 16: Public Event Pages & Registration

**Files:**
- Create: `apps/web/app/(public)/events/page.tsx`
- Create: `apps/web/app/(public)/events/[slug]/page.tsx`
- Create: `apps/web/app/(public)/events/[slug]/register/page.tsx`

- [ ] **Step 1: Create public event discovery page**

Grid of event cards. Fetches from `GET /api/events`. Shows event name, date, location, type badge.

- [ ] **Step 2: Create public event detail page**

Full event info: description, dates, venue, pricing tiers, registration button. Uses `GET /api/events/by-slug/:dojoSlug/:eventSlug`.

Note: The URL structure for public events is `/events/{dojoSlug}-{eventSlug}` — the page parses the combined slug and fetches via the API.

- [ ] **Step 3: Create registration page**

Tabbed form: Individual / Team / Minor (tabs shown based on event settings). Includes custom form fields fetched from the API. Shows pricing tier selector. On submit, creates registration then redirects to Stripe Checkout if payment needed.

---

## Task 17: Final Wiring & Typecheck

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 2: Verify all route imports resolve**

```bash
pnpm turbo build --filter=@kiai-hub/api
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: phase 2 — dojos, events, registration & payments"
```
