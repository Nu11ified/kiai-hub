import { z } from "zod";
import { EVENT_TYPES, CURRENCIES, KENDO_RANKS, FEDERATIONS } from "./constants.js";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createDojoSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(1000).optional(),
  federation: z.enum(FEDERATIONS).optional(),
  contactEmail: z.string().email().optional(),
  timezone: z.string().optional(),
  website: z.string().url().optional(),
});

export const createEventSchema = z
  .object({
    name: z.string().min(2).max(200),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
    type: z.enum(EVENT_TYPES),
    description: z.string().max(5000).optional(),
    startDate: z.union([z.string(), z.date()]),
    endDate: z.union([z.string(), z.date()]),
    venueName: z.string().optional(),
    venueAddress: z.string().optional(),
    venueCity: z.string().optional(),
    venueState: z.string().optional(),
    venueCountry: z.string().optional(),
    currency: z.enum(CURRENCIES).default("USD"),
    maxParticipants: z.number().int().positive().optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  kendoRank: z.enum(KENDO_RANKS).optional(),
  yearsExperience: z.number().int().nonnegative().optional(),
  federation: z.enum(FEDERATIONS).optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type CreateDojoInput = z.infer<typeof createDojoSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
