"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../lib/api";

interface Dojo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  federation?: string;
  contactEmail?: string;
  stripeConnectId?: string;
}

export default function DojoSettingsPage() {
  const params = useParams<{ dojoId: string }>();
  const dojoId = params.dojoId;

  const [dojo, setDojo] = useState<Dojo | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [federation, setFederation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get<Dojo>(`/dojos/${dojoId}`)
      .then((data) => {
        setDojo(data);
        setName(data.name);
        setDescription(data.description || "");
        setFederation(data.federation || "");
        setContactEmail(data.contactEmail || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dojoId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const body: Record<string, string> = { name };
      if (description) body.description = description;
      if (federation) body.federation = federation;
      if (contactEmail) body.contactEmail = contactEmail;

      const updated = await api.patch<Dojo>(`/dojos/${dojoId}`, body);
      setDojo(updated);
      setSuccess("Settings saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    setError("");

    try {
      const result = await api.post<{ url: string }>(`/dojos/${dojoId}/stripe-connect`);
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Stripe Connect");
      setConnectingStripe(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (!dojo) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">Dojo not found</div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Dojo Settings</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="federation" className="mb-1 block text-sm font-medium text-gray-700">
            Federation
          </label>
          <select
            id="federation"
            value={federation}
            onChange={(e) => setFederation(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">None</option>
            <option value="AUSKF">AUSKF</option>
            <option value="FIK">FIK</option>
            <option value="BKA">BKA</option>
            <option value="AKR">AKR</option>
            <option value="CKF">CKF</option>
            <option value="EKF">EKF</option>
            <option value="ZNKR">ZNKR</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="contactEmail" className="mb-1 block text-sm font-medium text-gray-700">
            Contact Email
          </label>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Stripe Connect</h2>
        {dojo.stripeConnectId ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Connected
            </span>
            <span className="text-sm text-gray-500">ID: {dojo.stripeConnectId}</span>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-500">
              Connect your Stripe account to accept payments for events.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={connectingStripe}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {connectingStripe ? "Connecting..." : "Connect Stripe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
