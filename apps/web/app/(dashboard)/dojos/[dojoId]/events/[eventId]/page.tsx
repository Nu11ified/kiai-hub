"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../../lib/api";

interface EventDashboard {
  event: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  totalRegistrations: number;
  paidRegistrations: number;
  totalRevenue: number;
}

export default function EventDashboardPage() {
  const params = useParams<{ dojoId: string; eventId: string }>();
  const { dojoId, eventId } = params;

  const [data, setData] = useState<EventDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api
      .get<EventDashboard>(`/events/dojo/${dojoId}/${eventId}/dashboard`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dojoId, eventId]);

  async function handlePublish() {
    setPublishing(true);
    setError("");

    try {
      await api.patch(`/events/dojo/${dojoId}/${eventId}`, { status: "published" });
      setData((prev) =>
        prev ? { ...prev, event: { ...prev.event, status: "published" } } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish event");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">Event not found</div>;
  }

  const { event } = data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {new Date(event.startDate).toLocaleDateString()} &mdash;{" "}
            {new Date(event.endDate).toLocaleDateString()}
          </p>
        </div>
        {event.status === "draft" && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish Event"}
          </button>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Registrations</p>
          <p className="mt-2 text-3xl font-bold">{data.totalRegistrations}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Paid</p>
          <p className="mt-2 text-3xl font-bold">{data.paidRegistrations}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Revenue</p>
          <p className="mt-2 text-3xl font-bold">
            ${(data.totalRevenue / 100).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={`/dojos/${dojoId}/events/${eventId}/registrations`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Registrations
        </a>
        <a
          href={`/dojos/${dojoId}/events/${eventId}/pricing`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Pricing
        </a>
        <a
          href={`/dojos/${dojoId}/events/${eventId}/forms`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Forms
        </a>
      </div>
    </div>
  );
}
