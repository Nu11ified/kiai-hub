import { Elysia, t } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import { documents, platformAssets, events } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { getEnv } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess, requireDojoAdmin } from "../middleware/dojo-access.js";
import { generateRulesPdf } from "../lib/pdf.js";
import { R2StorageProvider } from "@kiai-hub/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStorage() {
  return new R2StorageProvider({
    accountId: getEnv("R2_ACCOUNT_ID"),
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: getEnv("R2_BUCKET_NAME"),
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// documentRoutes
// ---------------------------------------------------------------------------

export const documentRoutes = new Elysia({ prefix: "/documents" })
  .use(requireAuth)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return jsonResponse({ error: error.message }, 500);
    }
  })

  // -------------------------------------------------------------------------
  // GET /platform-assets — list all platform assets (public, no dojo needed)
  // -------------------------------------------------------------------------
  .get("/platform-assets", async () => {
    const db = getDb();
    const assets = await db.select().from(platformAssets);
    return assets;
  })

  // -------------------------------------------------------------------------
  // Dojo-scoped group /dojo/:dojoId
  // -------------------------------------------------------------------------
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)
      .use(requireDojoAdmin)

      // GET /dojo/:dojoId/ — list documents for dojo
      .get("/", async ({ params }) => {
        const db = getDb();
        const docs = await db
          .select()
          .from(documents)
          .where(eq(documents.dojoId, params.dojoId));
        return docs;
      })

      // GET /dojo/:dojoId/event/:eventId — list documents for specific event
      .get("/event/:eventId", async ({ params }) => {
        const db = getDb();
        const docs = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.dojoId, params.dojoId),
              eq(documents.eventId, params.eventId)
            )
          );
        return docs;
      })

      // POST /dojo/:dojoId/upload — upload a document
      .post(
        "/upload",
        async ({ params, body, user }) => {
          const storage = getStorage();
          const db = getDb();

          // Decode base64 to Uint8Array (no Buffer in Cloudflare Workers)
          const binaryString = atob(body.fileBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const uuid = crypto.randomUUID();
          const storageKey = `dojos/${params.dojoId}/documents/${uuid}-${body.fileName}`;

          await storage.put(storageKey, bytes, {
            contentType: body.mimeType,
          });

          const [doc] = await db
            .insert(documents)
            .values({
              dojoId: params.dojoId,
              eventId: body.eventId ?? null,
              name: body.name,
              type: body.type,
              storageKey,
              mimeType: body.mimeType,
              sizeBytes: bytes.byteLength,
              uploadedBy: user.id,
            })
            .returning();

          return doc;
        },
        {
          body: t.Object({
            name: t.String(),
            fileName: t.String(),
            type: t.Union([
              t.Literal("rules"),
              t.Literal("waiver"),
              t.Literal("certificate"),
              t.Literal("roster"),
              t.Literal("bracket_sheet"),
              t.Literal("logo"),
              t.Literal("custom"),
            ]),
            mimeType: t.String(),
            fileBase64: t.String(),
            eventId: t.Optional(t.String()),
          }),
        }
      )

      // POST /dojo/:dojoId/generate-rules-pdf — generate a rules PDF
      .post(
        "/generate-rules-pdf",
        async ({ params, body, user }) => {
          const db = getDb();
          const storage = getStorage();

          // Look up the event
          const event = await db
            .select()
            .from(events)
            .where(
              and(
                eq(events.id, body.eventId),
                eq(events.dojoId, params.dojoId)
              )
            )
            .then((rows) => rows[0] ?? null);

          if (!event) {
            return jsonResponse({ error: "Event not found" }, 404);
          }

          // Build event date string
          const eventDate = event.startDate
            ? new Date(event.startDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "TBD";

          // Generate the PDF
          const pdfBytes = await generateRulesPdf({
            eventName: event.name,
            eventDate,
            venueName: event.venueName ?? undefined,
            sections: body.sections,
            matchRules: body.matchRules ?? undefined,
          });

          // Upload to R2
          const uuid = crypto.randomUUID();
          const fileName = `rules-${event.slug}-${uuid}.pdf`;
          const storageKey = `dojos/${params.dojoId}/documents/${uuid}-${fileName}`;

          await storage.put(storageKey, pdfBytes, {
            contentType: "application/pdf",
          });

          // Insert document record
          const [doc] = await db
            .insert(documents)
            .values({
              dojoId: params.dojoId,
              eventId: body.eventId,
              name: `Rules — ${event.name}`,
              type: "rules",
              storageKey,
              mimeType: "application/pdf",
              sizeBytes: pdfBytes.byteLength,
              uploadedBy: user.id,
            })
            .returning();

          return doc;
        },
        {
          body: t.Object({
            eventId: t.String(),
            sections: t.Array(
              t.Object({
                title: t.String(),
                content: t.String(),
              })
            ),
            matchRules: t.Optional(
              t.Object({
                duration: t.Number(),
                extensions: t.Optional(t.Number()),
                extensionDuration: t.Optional(t.Number()),
                ipponToWin: t.Number(),
                hansokuLimit: t.Number(),
                allowsEncho: t.Optional(t.Boolean()),
                enchoHantei: t.Optional(t.Boolean()),
              })
            ),
          }),
        }
      )

      // DELETE /dojo/:dojoId/:documentId — delete a document
      .delete("/:documentId", async ({ params }) => {
        const db = getDb();

        const doc = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, params.documentId),
              eq(documents.dojoId, params.dojoId)
            )
          )
          .then((rows) => rows[0] ?? null);

        if (!doc) {
          return jsonResponse({ error: "Document not found" }, 404);
        }

        // Delete from R2 (non-blocking)
        const storage = getStorage();
        storage.delete(doc.storageKey).catch(() => {
          // Non-blocking: ignore storage errors
        });

        // Delete from DB
        await db
          .delete(documents)
          .where(eq(documents.id, params.documentId));

        return { success: true };
      })

      // GET /dojo/:dojoId/:documentId/url — get signed download URL
      .get("/:documentId/url", async ({ params }) => {
        const db = getDb();

        const doc = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, params.documentId),
              eq(documents.dojoId, params.dojoId)
            )
          )
          .then((rows) => rows[0] ?? null);

        if (!doc) {
          return jsonResponse({ error: "Document not found" }, 404);
        }

        const storage = getStorage();
        const url = await storage.getSignedUrl(doc.storageKey, 3600);

        return { url, expiresIn: 3600 };
      })
  );
