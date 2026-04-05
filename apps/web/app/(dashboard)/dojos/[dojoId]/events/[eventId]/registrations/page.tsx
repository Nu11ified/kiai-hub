"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../../../lib/api";

interface Registration {
  id: string;
  participantName: string;
  type: string;
  email: string;
  paymentStatus: string;
  status: string;
  checkedIn: boolean;
}

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  free: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  waitlisted: "bg-blue-100 text-blue-700",
};

export default function RegistrationsPage() {
  const params = useParams<{ dojoId: string; eventId: string }>();
  const { dojoId, eventId } = params;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRegistrations();
  }, [dojoId, eventId]);

  function fetchRegistrations() {
    setLoading(true);
    api
      .get<Registration[]>(`/registrations/event/${dojoId}/${eventId}`)
      .then(setRegistrations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleCheckIn(registrationId: string) {
    setError("");
    try {
      await api.post(`/registrations/${registrationId}/check-in`);
      fetchRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in");
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Registrations</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Payment</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg) => (
              <tr key={reg.id} className="border-b border-gray-100">
                <td className="px-6 py-3">{reg.participantName}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {reg.type}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">{reg.email}</td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      PAYMENT_COLORS[reg.paymentStatus] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {reg.paymentStatus}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[reg.status] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {reg.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {!reg.checkedIn ? (
                    <button
                      onClick={() => handleCheckIn(reg.id)}
                      className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
                    >
                      Check In
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-medium">Checked In</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {registrations.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">No registrations yet</div>
        )}
      </div>
    </div>
  );
}
