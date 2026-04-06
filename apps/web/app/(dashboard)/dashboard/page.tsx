"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Dojo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role?: string;
}

export default function DashboardPage() {
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Dojo[]>("/dojos")
      .then(setDojos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <a
          href="/dojos/new"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Create Dojo
        </a>
      </div>

      {dojos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">No dojos yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Create your first dojo to start managing events.
          </p>
          <a
            href="/dojos/new"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Create Dojo
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dojos.map((dojo) => (
            <a
              key={dojo.id}
              href={`/dojos/${dojo.id}/events`}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
            >
              <h3 className="text-lg font-semibold">{dojo.name}</h3>
              {dojo.role && (
                <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {dojo.role}
                </span>
              )}
              {dojo.description && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                  {dojo.description}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
