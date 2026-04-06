"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../lib/api";

interface Event {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
}

const TYPE_COLORS: Record<string, string> = {
  taikai: "bg-red-100 text-red-700",
  seminar: "bg-blue-100 text-blue-700",
  shinsa: "bg-purple-100 text-purple-700",
  gasshuku: "bg-green-100 text-green-700",
  practice: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  registration_open: "bg-green-100 text-green-700",
  registration_closed: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function EventsPage() {
  const params = useParams<{ dojoId: string }>();
  const dojoId = params.dojoId;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Event[]>(`/events/dojo/${dojoId}`)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dojoId]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <a
          href={`/dojos/${dojoId}/events/new`}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Create Event
        </a>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">No events yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Create your first event to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <a
              key={event.id}
              href={`/dojos/${dojoId}/events/${event.id}`}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
            >
              <h3 className="text-lg font-semibold">{event.name}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(event.startDate).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[event.type] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {event.type}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[event.status] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {event.status.replace(/_/g, " ")}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
