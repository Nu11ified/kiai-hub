"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";

interface PricingTier {
  id: string;
  name: string;
  priceInCents: number;
  applicableTo: string;
  earlyBirdPriceInCents?: number;
  earlyBirdDeadline?: string;
}

interface EventDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  description?: string;
  startDate: string;
  endDate: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueCountry?: string;
  pricingTiers?: PricingTier[];
}

function parseSlug(slug: string): { dojoSlug: string; eventSlug: string } {
  const parts = slug.split("--");
  return {
    dojoSlug: parts[0] || "",
    eventSlug: parts[1] || "",
  };
}

export default function EventDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { dojoSlug, eventSlug } = parseSlug(slug);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dojoSlug || !eventSlug) {
      setError("Invalid event URL");
      setLoading(false);
      return;
    }

    api
      .get<EventDetail>(`/events/by-slug/${dojoSlug}/${eventSlug}`)
      .then(setEvent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dojoSlug, eventSlug]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading event...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  if (!event) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">Event not found</div>;
  }

  const location = [event.venueName, event.venueAddress, event.venueCity, event.venueState, event.venueCountry]
    .filter(Boolean)
    .join(", ");

  const isRegistrationOpen =
    event.status === "registration_open" || event.status === "published";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          {event.type}
        </span>
        <h1 className="mt-3 text-4xl font-bold">{event.name}</h1>
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-500">
          <div>
            <span className="font-medium text-gray-700">Start:</span>{" "}
            {new Date(event.startDate).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          <div>
            <span className="font-medium text-gray-700">End:</span>{" "}
            {new Date(event.endDate).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
        {location && (
          <p className="mt-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700">Venue:</span> {location}
          </p>
        )}
      </div>

      {event.description && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">About</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">{event.description}</p>
        </div>
      )}

      {event.pricingTiers && event.pricingTiers.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {event.pricingTiers.map((tier) => (
              <div
                key={tier.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="font-medium">{tier.name}</h3>
                <p className="mt-1 text-2xl font-bold">
                  ${(tier.priceInCents / 100).toFixed(2)}
                </p>
                <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {tier.applicableTo}
                </span>
                {tier.earlyBirdPriceInCents != null && (
                  <div className="mt-3 rounded-lg bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-700">
                      Early Bird: ${(tier.earlyBirdPriceInCents / 100).toFixed(2)}
                    </p>
                    {tier.earlyBirdDeadline && (
                      <p className="text-xs text-green-600">
                        Until {new Date(tier.earlyBirdDeadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isRegistrationOpen ? (
        <a
          href={`/events/${slug}/register`}
          className="inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Register Now
        </a>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-500">
            {event.status === "draft"
              ? "This event is not yet published."
              : event.status === "registration_closed"
                ? "Registration is closed for this event."
                : event.status === "completed"
                  ? "This event has concluded."
                  : event.status === "cancelled"
                    ? "This event has been cancelled."
                    : "Registration is not currently available."}
          </p>
        </div>
      )}
    </div>
  );
}
