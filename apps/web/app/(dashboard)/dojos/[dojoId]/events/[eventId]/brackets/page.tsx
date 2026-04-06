"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Bracket {
  id: string;
  name: string;
  type: string;
  format: string;
  status: string;
}

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  kachinuki: "Kachinuki",
  pool_to_elimination: "Pool → Elimination",
};

export default function BracketsPage() {
  const params = useParams();
  const router = useRouter();
  const dojoId = params.dojoId as string;
  const eventId = params.eventId as string;

  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "individual" as "individual" | "team",
    format: "single_elimination" as string,
  });

  useEffect(() => {
    api(`/brackets/event/${eventId}`).then(setBrackets);
  }, [eventId]);

  async function createBracket(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const bracket = await api(`/brackets/dojo/${dojoId}/create`, {
        method: "POST",
        body: JSON.stringify({ eventId, ...form }),
      });
      setBrackets((prev) => [...prev, bracket]);
      setForm({ name: "", type: "individual", format: "single_elimination" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Brackets</h1>

      <form onSubmit={createBracket} className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">New Bracket</h2>
        <div className="grid grid-cols-3 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Bracket name"
            className="rounded border px-3 py-2 text-sm"
            required
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "individual" | "team" })}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
          <select
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
          >
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating || !form.name}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Bracket"}
        </button>
      </form>

      <div className="divide-y rounded-lg border">
        {brackets.length === 0 && (
          <p className="p-4 text-gray-500 text-sm">No brackets created yet</p>
        )}
        {brackets.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => router.push(`/dojos/${dojoId}/events/${eventId}/brackets/${b.id}`)}
          >
            <div>
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-gray-500">
                {b.type} · {FORMAT_LABELS[b.format] ?? b.format}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                b.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : b.status === "in_progress"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {b.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
