"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Event {
  id: string;
  name: string;
  slug: string;
  type: string;
  startDate: string;
  venueName?: string;
  venueCity?: string;
  venueCountry?: string;
  dojo?: {
    slug: string;
  };
  dojoSlug?: string;
}

const TYPE_COLORS: Record<string, string> = {
  taikai: "bg-red-100 text-red-700",
  seminar: "bg-blue-100 text-blue-700",
  shinsa: "bg-purple-100 text-purple-700",
  gasshuku: "bg-green-100 text-green-700",
  practice: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-700",
};

export default function EventsDiscoveryPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Event[]>("/events")
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading events...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Events</h1>

      {events.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">No events available</h2>
          <p className="mt-2 text-sm text-gray-500">
            Check back later for upcoming events.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const dojoSlug = event.dojo?.slug || event.dojoSlug || "";
            const combinedSlug = `${dojoSlug}--${event.slug}`;
            const location = [event.venueCity, event.venueCountry]
              .filter(Boolean)
              .join(", ");

            return (
              <a
                key={event.id}
                href={`/events/${combinedSlug}`}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
              >
                <div className="mb-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      TYPE_COLORS[event.type] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {event.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">{event.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {new Date(event.startDate).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {location && (
                  <p className="mt-1 text-sm text-gray-400">{location}</p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
