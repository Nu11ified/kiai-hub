"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../../../lib/api";

interface PricingTier {
  id: string;
  name: string;
  priceInCents: number;
  applicableTo: string;
  earlyBirdPriceInCents?: number;
  earlyBirdDeadline?: string;
}

export default function PricingPage() {
  const params = useParams<{ dojoId: string; eventId: string }>();
  const { dojoId, eventId } = params;

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tierName, setTierName] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [applicableTo, setApplicableTo] = useState("individual");
  const [earlyBirdDollars, setEarlyBirdDollars] = useState("");
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, [dojoId, eventId]);

  function fetchTiers() {
    setLoading(true);
    api
      .get<PricingTier[]>(`/events/dojo/${dojoId}/${eventId}/pricing`)
      .then(setTiers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);

    try {
      const body: Record<string, unknown> = {
        name: tierName,
        priceInCents: Math.round(parseFloat(priceDollars) * 100),
        applicableTo,
      };
      if (earlyBirdDollars) {
        body.earlyBirdPriceInCents = Math.round(parseFloat(earlyBirdDollars) * 100);
      }
      if (earlyBirdDeadline) {
        body.earlyBirdDeadline = earlyBirdDeadline;
      }

      await api.post(`/events/dojo/${dojoId}/${eventId}/pricing`, body);
      setTierName("");
      setPriceDollars("");
      setApplicableTo("individual");
      setEarlyBirdDollars("");
      setEarlyBirdDeadline("");
      fetchTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tier");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTier(tierId: string) {
    setError("");
    try {
      await api.delete(`/events/dojo/${dojoId}/${eventId}/pricing/${tierId}`);
      fetchTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tier");
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pricing Tiers</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{tier.name}</h3>
                <p className="mt-1 text-2xl font-bold">
                  ${(tier.priceInCents / 100).toFixed(2)}
                </p>
                <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {tier.applicableTo}
                </span>
              </div>
              <button
                onClick={() => handleDeleteTier(tier.id)}
                className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
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
        {tiers.length === 0 && (
          <div className="col-span-full rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            No pricing tiers yet
          </div>
        )}
      </div>

      <form
        onSubmit={handleAddTier}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold">Add Pricing Tier</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tierName" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="tierName"
              type="text"
              required
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="priceDollars" className="mb-1 block text-sm font-medium text-gray-700">
              Price ($)
            </label>
            <input
              id="priceDollars"
              type="number"
              required
              min="0"
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="applicableTo" className="mb-1 block text-sm font-medium text-gray-700">
            Applicable To
          </label>
          <select
            id="applicableTo"
            value={applicableTo}
            onChange={(e) => setApplicableTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
            <option value="minor">Minor</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="earlyBirdDollars" className="mb-1 block text-sm font-medium text-gray-700">
              Early Bird Price ($) (optional)
            </label>
            <input
              id="earlyBirdDollars"
              type="number"
              min="0"
              step="0.01"
              value={earlyBirdDollars}
              onChange={(e) => setEarlyBirdDollars(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="earlyBirdDeadline" className="mb-1 block text-sm font-medium text-gray-700">
              Early Bird Deadline (optional)
            </label>
            <input
              id="earlyBirdDeadline"
              type="datetime-local"
              value={earlyBirdDeadline}
              onChange={(e) => setEarlyBirdDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Tier"}
        </button>
      </form>
    </div>
  );
}
