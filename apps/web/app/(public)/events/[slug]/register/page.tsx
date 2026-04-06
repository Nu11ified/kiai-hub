"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../lib/api";

interface PricingTier {
  id: string;
  name: string;
  priceInCents: number;
  applicableTo: string;
  earlyBirdPriceInCents?: number;
  earlyBirdDeadline?: string;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

interface EventDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  pricingTiers?: PricingTier[];
  formFields?: FormField[];
}

interface RegistrationResult {
  id: string;
  paymentStatus: string;
}

function parseSlug(slug: string): { dojoSlug: string; eventSlug: string } {
  const parts = slug.split("--");
  return {
    dojoSlug: parts[0] || "",
    eventSlug: parts[1] || "",
  };
}

type RegistrationType = "individual" | "team" | "minor";

const KENDO_RANKS = [
  "unranked", "6-kyu", "5-kyu", "4-kyu", "3-kyu", "2-kyu", "1-kyu",
  "1-dan", "2-dan", "3-dan", "4-dan", "5-dan", "6-dan", "7-dan", "8-dan",
];

export default function RegisterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { dojoSlug, eventSlug } = parseSlug(slug);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  const [regType, setRegType] = useState<RegistrationType>("individual");

  // Individual fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [rank, setRank] = useState("unranked");
  const [federation, setFederation] = useState("");
  const [dojoName, setDojoName] = useState("");
  const [pricingTierId, setPricingTierId] = useState("");

  // Team fields
  const [teamName, setTeamName] = useState("");
  const [teamDojoName, setTeamDojoName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [teamPricingTierId, setTeamPricingTierId] = useState("");

  // Minor fields
  const [minorName, setMinorName] = useState("");
  const [minorDob, setMinorDob] = useState("");
  const [minorRank, setMinorRank] = useState("unranked");
  const [minorDojoName, setMinorDojoName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [minorPricingTierId, setMinorPricingTierId] = useState("");

  // Custom form fields
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

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

  function getFilteredTiers(type: string): PricingTier[] {
    if (!event?.pricingTiers) return [];
    return event.pricingTiers.filter(
      (t) => t.applicableTo === type || t.applicableTo === "all"
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let endpoint = "";
      let body: Record<string, unknown> = {};

      if (regType === "individual") {
        endpoint = `/registrations/individual`;
        body = {
          eventId: event?.id,
          participantName: name,
          email,
          dateOfBirth: dob,
          rank,
          federation: federation || undefined,
          dojoName: dojoName || undefined,
          pricingTierId: pricingTierId || undefined,
          customFields,
        };
      } else if (regType === "team") {
        endpoint = `/registrations/team`;
        body = {
          eventId: event?.id,
          teamName,
          dojoName: teamDojoName || undefined,
          captainName,
          captainEmail,
          pricingTierId: teamPricingTierId || undefined,
        };
      } else {
        endpoint = `/registrations/minor`;
        body = {
          eventId: event?.id,
          participantName: minorName,
          dateOfBirth: minorDob,
          rank: minorRank,
          dojoName: minorDojoName || undefined,
          guardianName,
          guardianEmail,
          guardianPhone,
          pricingTierId: minorPricingTierId || undefined,
          customFields,
        };
      }

      const result = await api.post<RegistrationResult>(endpoint, body);

      if (result.paymentStatus === "pending") {
        try {
          const payment = await api.post<{ clientSecret: string }>(
            "/payments/create-intent",
            { registrationId: result.id }
          );
          setPaymentMessage(
            `Payment required. A payment intent has been created (client secret: ${payment.clientSecret}). In a production app, this would open Stripe Elements to complete payment.`
          );
        } catch {
          setPaymentMessage(
            "Payment is required to complete your registration. Please contact the event organizer."
          );
        }
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error && !event) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  if (!event) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">Event not found</div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-green-700">Registration Submitted</h1>
          <p className="mt-3 text-sm text-gray-600">
            Your registration for {event.name} has been submitted successfully.
          </p>
          {paymentMessage && (
            <div className="mt-4 rounded-lg bg-yellow-50 p-4 text-left text-sm text-yellow-700">
              {paymentMessage}
            </div>
          )}
          <a
            href={`/events/${slug}`}
            className="mt-6 inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to Event
          </a>
        </div>
      </div>
    );
  }

  const individualTiers = getFilteredTiers("individual");
  const teamTiers = getFilteredTiers("team");
  const minorTiers = getFilteredTiers("minor");
  const formFields = event.formFields || [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Register for {event.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {new Date(event.startDate).toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-6 flex gap-2">
        {(["individual", "team", "minor"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setRegType(type)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              regType === type
                ? "bg-gray-900 text-white"
                : "border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {regType === "individual" && (
          <>
            <div>
              <label htmlFor="ind-name" className="mb-1 block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="ind-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="ind-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="ind-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="ind-dob" className="mb-1 block text-sm font-medium text-gray-700">
                Date of Birth
              </label>
              <input
                id="ind-dob"
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="ind-rank" className="mb-1 block text-sm font-medium text-gray-700">
                Rank
              </label>
              <select
                id="ind-rank"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {KENDO_RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ind-federation" className="mb-1 block text-sm font-medium text-gray-700">
                Federation
              </label>
              <input
                id="ind-federation"
                type="text"
                value={federation}
                onChange={(e) => setFederation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="ind-dojo" className="mb-1 block text-sm font-medium text-gray-700">
                Dojo Name
              </label>
              <input
                id="ind-dojo"
                type="text"
                value={dojoName}
                onChange={(e) => setDojoName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {individualTiers.length > 0 && (
              <div>
                <label htmlFor="ind-tier" className="mb-1 block text-sm font-medium text-gray-700">
                  Pricing Tier
                </label>
                <select
                  id="ind-tier"
                  value={pricingTierId}
                  onChange={(e) => setPricingTierId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select a tier</option>
                  {individualTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - ${(tier.priceInCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formFields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`custom-${field.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={`custom-${field.id}`}
                    required={field.required}
                    value={customFields[field.id] || ""}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                ) : field.type === "checkbox" ? (
                  <input
                    id={`custom-${field.id}`}
                    type="checkbox"
                    checked={customFields[field.id] === "true"}
                    onChange={(e) =>
                      setCustomFields((prev) => ({
                        ...prev,
                        [field.id]: e.target.checked ? "true" : "false",
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                ) : (
                  <input
                    id={`custom-${field.id}`}
                    type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
                    required={field.required}
                    value={customFields[field.id] || ""}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}
              </div>
            ))}
          </>
        )}

        {regType === "team" && (
          <>
            <div>
              <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-gray-700">
                Team Name
              </label>
              <input
                id="team-name"
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="team-dojo" className="mb-1 block text-sm font-medium text-gray-700">
                Dojo Name
              </label>
              <input
                id="team-dojo"
                type="text"
                value={teamDojoName}
                onChange={(e) => setTeamDojoName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="captain-name" className="mb-1 block text-sm font-medium text-gray-700">
                Captain Name
              </label>
              <input
                id="captain-name"
                type="text"
                required
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="captain-email" className="mb-1 block text-sm font-medium text-gray-700">
                Captain Email
              </label>
              <input
                id="captain-email"
                type="email"
                required
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {teamTiers.length > 0 && (
              <div>
                <label htmlFor="team-tier" className="mb-1 block text-sm font-medium text-gray-700">
                  Pricing Tier
                </label>
                <select
                  id="team-tier"
                  value={teamPricingTierId}
                  onChange={(e) => setTeamPricingTierId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select a tier</option>
                  {teamTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - ${(tier.priceInCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {regType === "minor" && (
          <>
            <div>
              <label htmlFor="minor-name" className="mb-1 block text-sm font-medium text-gray-700">
                Participant Name
              </label>
              <input
                id="minor-name"
                type="text"
                required
                value={minorName}
                onChange={(e) => setMinorName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="minor-dob" className="mb-1 block text-sm font-medium text-gray-700">
                Date of Birth
              </label>
              <input
                id="minor-dob"
                type="date"
                required
                value={minorDob}
                onChange={(e) => setMinorDob(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="minor-rank" className="mb-1 block text-sm font-medium text-gray-700">
                Rank
              </label>
              <select
                id="minor-rank"
                value={minorRank}
                onChange={(e) => setMinorRank(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {KENDO_RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="minor-dojo" className="mb-1 block text-sm font-medium text-gray-700">
                Dojo Name
              </label>
              <input
                id="minor-dojo"
                type="text"
                value={minorDojoName}
                onChange={(e) => setMinorDojoName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="guardian-name" className="mb-1 block text-sm font-medium text-gray-700">
                Guardian Name
              </label>
              <input
                id="guardian-name"
                type="text"
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="guardian-email" className="mb-1 block text-sm font-medium text-gray-700">
                Guardian Email
              </label>
              <input
                id="guardian-email"
                type="email"
                required
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label htmlFor="guardian-phone" className="mb-1 block text-sm font-medium text-gray-700">
                Guardian Phone
              </label>
              <input
                id="guardian-phone"
                type="tel"
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {minorTiers.length > 0 && (
              <div>
                <label htmlFor="minor-tier" className="mb-1 block text-sm font-medium text-gray-700">
                  Pricing Tier
                </label>
                <select
                  id="minor-tier"
                  value={minorPricingTierId}
                  onChange={(e) => setMinorPricingTierId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select a tier</option>
                  {minorTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - ${(tier.priceInCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formFields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`custom-minor-${field.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={`custom-minor-${field.id}`}
                    required={field.required}
                    value={customFields[field.id] || ""}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                ) : field.type === "checkbox" ? (
                  <input
                    id={`custom-minor-${field.id}`}
                    type="checkbox"
                    checked={customFields[field.id] === "true"}
                    onChange={(e) =>
                      setCustomFields((prev) => ({
                        ...prev,
                        [field.id]: e.target.checked ? "true" : "false",
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                ) : (
                  <input
                    id={`custom-minor-${field.id}`}
                    type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
                    required={field.required}
                    value={customFields[field.id] || ""}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}
              </div>
            ))}
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Registration"}
        </button>
      </form>
    </div>
  );
}
