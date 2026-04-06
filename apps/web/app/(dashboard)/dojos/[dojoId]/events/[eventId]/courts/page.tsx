"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Court {
  id: string;
  courtNumber: number;
  name: string | null;
}

interface ShinpanAssignment {
  id: string;
  shinpanName: string;
  role: "shushin" | "fukushin";
  rotationGroup: number;
}

export default function CourtsPage() {
  const params = useParams();
  const dojoId = params.dojoId as string;
  const eventId = params.eventId as string;

  const [courtList, setCourts] = useState<Court[]>([]);
  const [courtCount, setCourtCount] = useState(3);
  const [shinpanMap, setShinpanMap] = useState<Map<string, ShinpanAssignment[]>>(new Map());
  const [newShinpan, setNewShinpan] = useState<{ name: string; role: "shushin" | "fukushin"; courtId: string }>({ name: "", role: "fukushin", courtId: "" });

  useEffect(() => { loadCourts(); }, [dojoId, eventId]);

  async function loadCourts() {
    const data = await api(`/courts/dojo/${dojoId}/event/${eventId}/courts`);
    setCourts(data);

    const map = new Map<string, ShinpanAssignment[]>();
    for (const court of data) {
      const shinpan = await api(`/courts/dojo/${dojoId}/courts/${court.id}/shinpan`);
      map.set(court.id, shinpan);
    }
    setShinpanMap(map);
  }

  async function createCourts() {
    await api(`/courts/dojo/${dojoId}/event/${eventId}/courts`, {
      method: "POST",
      body: JSON.stringify({ count: courtCount }),
    });
    loadCourts();
  }

  async function addShinpan(e: React.FormEvent) {
    e.preventDefault();
    if (!newShinpan.courtId || !newShinpan.name) return;

    await api(`/courts/dojo/${dojoId}/courts/${newShinpan.courtId}/shinpan`, {
      method: "POST",
      body: JSON.stringify({ shinpanName: newShinpan.name, role: newShinpan.role }),
    });
    setNewShinpan({ name: "", role: "fukushin", courtId: "" });
    loadCourts();
  }

  async function removeShinpan(assignmentId: string) {
    await api(`/courts/dojo/${dojoId}/shinpan/${assignmentId}`, { method: "DELETE" });
    loadCourts();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Courts & Shinpan</h1>

      {courtList.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-gray-500 mb-4">No courts set up yet</p>
          <div className="flex items-center justify-center gap-3">
            <label className="text-sm">Number of courts:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={courtCount}
              onChange={(e) => setCourtCount(parseInt(e.target.value) || 1)}
              className="w-20 rounded border px-3 py-2 text-sm"
            />
            <button onClick={createCourts} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Create Courts
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courtList.map((court) => {
            const shinpanList = shinpanMap.get(court.id) ?? [];
            const shushin = shinpanList.filter((s) => s.role === "shushin");
            const fukushin = shinpanList.filter((s) => s.role === "fukushin");

            return (
              <div key={court.id} className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">{court.name ?? `Court ${court.courtNumber}`}</h3>

                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-500 uppercase font-medium">Shushin (Center)</p>
                  {shushin.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.shinpanName}</span>
                      <button onClick={() => removeShinpan(s.id)} className="text-red-500 text-xs">Remove</button>
                    </div>
                  ))}
                  {shushin.length === 0 && <p className="text-sm text-gray-400">Not assigned</p>}

                  <p className="text-xs text-gray-500 uppercase font-medium mt-2">Fukushin (Sides)</p>
                  {fukushin.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.shinpanName}</span>
                      <button onClick={() => removeShinpan(s.id)} className="text-red-500 text-xs">Remove</button>
                    </div>
                  ))}
                  {fukushin.length === 0 && <p className="text-sm text-gray-400">Not assigned</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {courtList.length > 0 && (
        <form onSubmit={addShinpan} className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Add Shinpan</h2>
          <div className="grid grid-cols-4 gap-3">
            <input
              value={newShinpan.name}
              onChange={(e) => setNewShinpan({ ...newShinpan, name: e.target.value })}
              placeholder="Shinpan name"
              className="rounded border px-3 py-2 text-sm"
              required
            />
            <select
              value={newShinpan.role}
              onChange={(e) => setNewShinpan({ ...newShinpan, role: e.target.value as "shushin" | "fukushin" })}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="shushin">Shushin (Center)</option>
              <option value="fukushin">Fukushin (Side)</option>
            </select>
            <select
              value={newShinpan.courtId}
              onChange={(e) => setNewShinpan({ ...newShinpan, courtId: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
              required
            >
              <option value="">Select court...</option>
              {courtList.map((c) => (
                <option key={c.id} value={c.id}>{c.name ?? `Court ${c.courtNumber}`}</option>
              ))}
            </select>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
