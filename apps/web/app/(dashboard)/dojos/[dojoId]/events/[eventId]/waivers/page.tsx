"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Registration {
  id: string;
  participantName: string;
  participantEmail: string;
  waiverStatus: "not_required" | "pending" | "signed";
  isMinor: boolean;
  guardianName?: string;
  guardianEmail?: string;
}

interface WaiverTemplate {
  id: string;
  name: string;
  docusealTemplateId: string | null;
}

export default function WaiversPage() {
  const params = useParams();
  const dojoId = params.dojoId as string;
  const eventId = params.eventId as string;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    api(`/registrations/event/${dojoId}/${eventId}`).then(setRegistrations);
    api(`/waivers/dojo/${dojoId}/templates`).then(setTemplates);
  }, [dojoId, eventId]);

  const pendingWaivers = registrations.filter((r) => r.waiverStatus === "pending");
  const signedWaivers = registrations.filter((r) => r.waiverStatus === "signed");

  async function sendWaiver(registrationId: string) {
    if (!selectedTemplate) return;
    setSending(registrationId);
    try {
      await api("/waivers/send", {
        method: "POST",
        body: JSON.stringify({ registrationId, templateId: selectedTemplate }),
      });
      const updated = await api(`/registrations/event/${dojoId}/${eventId}`);
      setRegistrations(updated);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Waiver Tracking</h1>
        <span className="text-sm text-gray-500">
          {signedWaivers.length}/{registrations.filter((r) => r.waiverStatus !== "not_required").length} signed
        </span>
      </div>

      {templates.length > 0 && (
        <div className="rounded-lg border p-4">
          <label className="block text-sm font-medium mb-2">Waiver Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pending ({pendingWaivers.length})</h2>
        <div className="divide-y rounded-lg border">
          {pendingWaivers.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">No pending waivers</p>
          )}
          {pendingWaivers.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{r.participantName}</p>
                <p className="text-sm text-gray-500">
                  {r.isMinor ? `Guardian: ${r.guardianName} (${r.guardianEmail})` : r.participantEmail}
                </p>
              </div>
              <button
                onClick={() => sendWaiver(r.id)}
                disabled={!selectedTemplate || sending === r.id}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending === r.id ? "Sending..." : "Send Waiver"}
              </button>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-semibold">Signed ({signedWaivers.length})</h2>
        <div className="divide-y rounded-lg border">
          {signedWaivers.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">No signed waivers yet</p>
          )}
          {signedWaivers.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{r.participantName}</p>
                <p className="text-sm text-gray-500">{r.participantEmail}</p>
              </div>
              <span className="text-sm text-green-600 font-medium">Signed</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
