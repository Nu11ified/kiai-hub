import { Elysia, t } from "elysia";
import { eq, and } from "@kiai-hub/db/operators";
import { waiverTemplates, registrations, events } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dojoAccess, requireDojoAdmin } from "../middleware/dojo-access.js";
import { createSubmission, getSubmission } from "../lib/docuseal.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMinor(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const ageCutoff = new Date();
  ageCutoff.setFullYear(ageCutoff.getFullYear() - 18);
  return dob > ageCutoff;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// waiverRoutes — requires auth
// ---------------------------------------------------------------------------

export const waiverRoutes = new Elysia({ prefix: "/waivers" })
  .use(requireAuth)
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return jsonResponse({ error: error.message }, 500);
    }
  })

  // -------------------------------------------------------------------------
  // Dojo-scoped template management
  // -------------------------------------------------------------------------
  .group("/dojo/:dojoId", (app) =>
    app
      .use(dojoAccess)
      .use(requireDojoAdmin)

      // GET /dojo/:dojoId/templates — list waiver templates for dojo
      .get("/templates", async ({ params }) => {
        const db = getDb();

        const templates = await db
          .select()
          .from(waiverTemplates)
          .where(eq(waiverTemplates.dojoId, params.dojoId));

        return templates;
      })

      // POST /dojo/:dojoId/templates — create a waiver template
      .post(
        "/templates",
        async ({ params, body }) => {
          const db = getDb();

          const [template] = await db
            .insert(waiverTemplates)
            .values({
              dojoId: params.dojoId,
              name: body.name,
              eventId: body.eventId ?? null,
              docusealTemplateId: body.docusealTemplateId ?? null,
              storageKey: body.storageKey ?? null,
              isDefault: body.isDefault ?? false,
            })
            .returning();

          return template;
        },
        {
          body: t.Object({
            name: t.String(),
            eventId: t.Optional(t.String()),
            docusealTemplateId: t.Optional(t.String()),
            storageKey: t.Optional(t.String()),
            isDefault: t.Optional(t.Boolean()),
          }),
        }
      )

      // DELETE /dojo/:dojoId/templates/:templateId — delete a waiver template
      .delete("/templates/:templateId", async ({ params }) => {
        const db = getDb();

        const template = await db
          .select()
          .from(waiverTemplates)
          .where(
            and(
              eq(waiverTemplates.id, params.templateId),
              eq(waiverTemplates.dojoId, params.dojoId)
            )
          )
          .then((rows) => rows[0] ?? null);

        if (!template) {
          return jsonResponse({ error: "Waiver template not found" }, 404);
        }

        await db
          .delete(waiverTemplates)
          .where(eq(waiverTemplates.id, params.templateId));

        return { success: true };
      })
  )

  // -------------------------------------------------------------------------
  // POST /send — send waiver to a registrant via DocuSeal
  // -------------------------------------------------------------------------
  .post(
    "/send",
    async ({ body }) => {
      const db = getDb();

      // 1. Look up registration
      const registration = await db
        .select()
        .from(registrations)
        .where(eq(registrations.id, body.registrationId))
        .then((rows) => rows[0] ?? null);

      if (!registration) {
        return jsonResponse({ error: "Registration not found" }, 404);
      }

      // 2. Look up waiver template
      const template = await db
        .select()
        .from(waiverTemplates)
        .where(eq(waiverTemplates.id, body.templateId))
        .then((rows) => rows[0] ?? null);

      if (!template) {
        return jsonResponse({ error: "Waiver template not found" }, 404);
      }

      if (!template.docusealTemplateId) {
        return jsonResponse(
          { error: "Waiver template has no DocuSeal template ID configured" },
          400
        );
      }

      // 3. Determine signer — guardian if minor, participant otherwise
      const signerName = registration.isMinor
        ? (registration.guardianName ?? registration.participantName)
        : registration.participantName;

      const signerEmail = registration.isMinor
        ? (registration.guardianEmail ?? registration.participantEmail)
        : registration.participantEmail;

      if (!signerEmail) {
        return jsonResponse({ error: "No email address available for signer" }, 400);
      }

      // 4. Call DocuSeal createSubmission
      const submission = await createSubmission({
        template_id: template.docusealTemplateId,
        send_email: true,
        submitters: [
          {
            role: "Signer",
            name: signerName,
            email: signerEmail,
            fields: [
              { name: "ParticipantName", default_value: registration.participantName },
              ...(registration.isMinor
                ? [{ name: "GuardianName", default_value: signerName }]
                : []),
            ],
          },
        ],
      });

      // 5. Update registration with waiver status and submission ID
      const updated = await db
        .update(registrations)
        .set({
          waiverStatus: "pending",
          docusealSubmissionId: String(submission.id),
        })
        .where(eq(registrations.id, body.registrationId))
        .returning()
        .then((rows) => rows[0]);

      // 6. Send email notification (non-blocking)
      try {
        // Email notification would be sent here if an email service is configured.
        // Currently a no-op placeholder — integrate with a mailer as needed.
      } catch {
        // Non-blocking: ignore email errors
      }

      return {
        submission,
        registration: updated,
      };
    },
    {
      body: t.Object({
        registrationId: t.String(),
        templateId: t.String(),
      }),
    }
  )

  // -------------------------------------------------------------------------
  // GET /status/:registrationId — check waiver status
  // -------------------------------------------------------------------------
  .get("/status/:registrationId", async ({ params, query }) => {
    const db = getDb();

    const registration = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, params.registrationId))
      .then((rows) => rows[0] ?? null);

    if (!registration) {
      return jsonResponse({ error: "Registration not found" }, 404);
    }

    // Optionally refresh status from DocuSeal
    if (query.refresh === "true" && registration.docusealSubmissionId) {
      try {
        const submission = await getSubmission(registration.docusealSubmissionId);

        // Map DocuSeal submission status to our waiverStatus
        if (submission.status === "completed") {
          const updated = await db
            .update(registrations)
            .set({ waiverStatus: "signed" })
            .where(eq(registrations.id, params.registrationId))
            .returning()
            .then((rows) => rows[0]);

          return {
            waiverStatus: updated?.waiverStatus ?? "signed",
            docusealSubmissionId: registration.docusealSubmissionId,
            submission,
          };
        }

        return {
          waiverStatus: registration.waiverStatus,
          docusealSubmissionId: registration.docusealSubmissionId,
          submission,
        };
      } catch {
        // Fall through and return cached status on DocuSeal error
      }
    }

    return {
      waiverStatus: registration.waiverStatus,
      docusealSubmissionId: registration.docusealSubmissionId ?? null,
    };
  });

// ---------------------------------------------------------------------------
// waiverWebhookRoute — no auth, DocuSeal webhook receiver
// ---------------------------------------------------------------------------

export const waiverWebhookRoute = new Elysia({ prefix: "/waivers" })
  .onError({ as: "scoped" }, ({ code, error }) => {
    if (code === "UNKNOWN") {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  })

  // POST /webhook
  .post("/webhook", async ({ request }) => {
    const db = getDb();

    let payload: { event_type?: string; data?: { id?: number | string; status?: string } };

    try {
      payload = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (payload.event_type === "submission.completed") {
      const submissionId = payload.data?.id;

      if (submissionId !== undefined && submissionId !== null) {
        await db
          .update(registrations)
          .set({ waiverStatus: "signed" })
          .where(eq(registrations.docusealSubmissionId, String(submissionId)));
      }
    }

    return { received: true };
  });
