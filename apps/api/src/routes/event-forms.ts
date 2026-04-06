import { Elysia, t } from "elysia";
import { eq, and, asc } from "@kiai-hub/db/operators";
import { customFormFields, events } from "@kiai-hub/db/schema";
import { getDb } from "../lib/db.js";
import { dojoAccess } from "../middleware/dojo-access.js";

export const eventFormRoutes = new Elysia({
  prefix: "/events/dojo/:dojoId/:eventId/forms",
})
  .use(dojoAccess)

  // List form fields for event
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

    const fields = await db
      .select()
      .from(customFormFields)
      .where(eq(customFormFields.eventId, params.eventId))
      .orderBy(asc(customFormFields.sortOrder));

    return { data: fields };
  })

  // Create form field (admin+)
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
        .insert(customFormFields)
        .values({
          eventId: params.eventId,
          label: body.label,
          type: body.type,
          options: body.options,
          required: body.required,
          placeholder: body.placeholder,
          helpText: body.helpText,
          sortOrder: body.sortOrder,
          section: body.section,
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
        label: t.String(),
        type: t.Union([
          t.Literal("text"),
          t.Literal("textarea"),
          t.Literal("select"),
          t.Literal("multiselect"),
          t.Literal("checkbox"),
          t.Literal("radio"),
          t.Literal("date"),
          t.Literal("file"),
          t.Literal("number"),
        ]),
        options: t.Optional(t.Any()),
        required: t.Optional(t.Boolean()),
        placeholder: t.Optional(t.String()),
        helpText: t.Optional(t.String()),
        sortOrder: t.Optional(t.Number()),
        section: t.Optional(t.String()),
      }),
    },
  )

  // Update form field (admin+)
  .patch(
    "/:fieldId",
    async ({ params, body }) => {
      const db = getDb();

      // Verify field belongs to this event and event belongs to this dojo
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

      const field = await db
        .select({ id: customFormFields.id })
        .from(customFormFields)
        .where(
          and(
            eq(customFormFields.id, params.fieldId),
            eq(customFormFields.eventId, params.eventId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!field) {
        return new Response(
          JSON.stringify({ error: "Form field not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body.label !== undefined) updateData.label = body.label;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.options !== undefined) updateData.options = body.options;
      if (body.required !== undefined) updateData.required = body.required;
      if (body.placeholder !== undefined) updateData.placeholder = body.placeholder;
      if (body.helpText !== undefined) updateData.helpText = body.helpText;
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
      if (body.section !== undefined) updateData.section = body.section;

      const updated = await db
        .update(customFormFields)
        .set(updateData)
        .where(eq(customFormFields.id, params.fieldId))
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
        label: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal("text"),
            t.Literal("textarea"),
            t.Literal("select"),
            t.Literal("multiselect"),
            t.Literal("checkbox"),
            t.Literal("radio"),
            t.Literal("date"),
            t.Literal("file"),
            t.Literal("number"),
          ]),
        ),
        options: t.Optional(t.Any()),
        required: t.Optional(t.Boolean()),
        placeholder: t.Optional(t.String()),
        helpText: t.Optional(t.String()),
        sortOrder: t.Optional(t.Number()),
        section: t.Optional(t.String()),
      }),
    },
  )

  // Delete form field (admin+)
  .delete("/:fieldId", async ({ params }) => {
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

    const field = await db
      .select({ id: customFormFields.id })
      .from(customFormFields)
      .where(
        and(
          eq(customFormFields.id, params.fieldId),
          eq(customFormFields.eventId, params.eventId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!field) {
      return new Response(
        JSON.stringify({ error: "Form field not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    await db
      .delete(customFormFields)
      .where(eq(customFormFields.id, params.fieldId));

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
