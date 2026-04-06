"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Match {
  id: string;
  roundNumber: number;
  matchNumber: number;
  courtNumber: number | null;
  player1EntryId: string | null;
  player2EntryId: string | null;
  winnerEntryId: string | null;
  winMethod: string | null;
  status: string;
}

interface Entry {
  entry: {
    id: string;
    seedNumber: number | null;
    eliminated: boolean;
    finalPlacement: number | null;
  };
  registration: {
    participantName: string;
    participantRank: string | null;
  } | null;
}

interface Bracket {
  id: string;
  name: string;
  format: string;
  status: string;
  seedMethod: string;
  byeMethod: string;
}

export default function BracketDetailPage() {
  const params = useParams();
  const dojoId = params.dojoId as string;
  const bracketId = params.bracketId as string;

  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [matchList, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [b, m, e] = await Promise.all([
      api(`/brackets/${bracketId}`),
      api(`/brackets/${bracketId}/matches`),
      api(`/brackets/${bracketId}/entries`),
    ]);
    setBracket(b);
    setMatches(m);
    setEntries(e);
    setLoading(false);
  }, [bracketId]);

  useEffect(() => { load(); }, [load]);

  const entryMap = new Map(entries.map((e) => [e.entry.id, e]));

  function getEntryName(entryId: string | null): string {
    if (!entryId) return "TBD";
    const entry = entryMap.get(entryId);
    return entry?.registration?.participantName ?? "Unknown";
  }

  async function seedBracket() {
    await api(`/brackets/dojo/${dojoId}/${bracketId}/seed`, { method: "POST" });
    load();
  }

  async function generateMatches() {
    await api(`/brackets/dojo/${dojoId}/${bracketId}/generate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    load();
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (!bracket) return <div className="p-4">Bracket not found</div>;

  const rounds = new Map<number, Match[]>();
  for (const m of matchList) {
    const round = rounds.get(m.roundNumber) ?? [];
    round.push(m);
    rounds.set(m.roundNumber, round);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bracket.name}</h1>
          <p className="text-sm text-gray-500">
            {bracket.format.replace(/_/g, " ")} · {bracket.status}
          </p>
        </div>
        <div className="flex gap-2">
          {bracket.status === "setup" && (
            <button onClick={seedBracket} className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700">
              Seed Entries
            </button>
          )}
          {(bracket.status === "setup" || bracket.status === "seeded") && matchList.length === 0 && (
            <button onClick={generateMatches} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Generate Matches
            </button>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Entries ({entries.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {entries
            .sort((a, b) => (a.entry.seedNumber ?? 999) - (b.entry.seedNumber ?? 999))
            .map((e) => (
              <div
                key={e.entry.id}
                className={`rounded border px-3 py-2 text-sm ${e.entry.eliminated ? "bg-red-50 text-red-700" : ""}`}
              >
                <span className="font-mono text-gray-400 mr-1">{e.entry.seedNumber ?? "—"}.</span>
                {e.registration?.participantName ?? "Unknown"}
                {e.registration?.participantRank && (
                  <span className="text-gray-400 ml-1">({e.registration.participantRank})</span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Bracket Visualization */}
      {matchList.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-8 min-w-max p-4">
            {[...rounds.entries()]
              .sort(([a], [b]) => a - b)
              .map(([roundNum, roundMatches]) => (
                <div key={roundNum} className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-gray-500 text-center">Round {roundNum}</h3>
                  {roundMatches.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded border p-3 min-w-[200px] ${
                        m.status === "completed" ? "border-green-200 bg-green-50"
                          : m.status === "in_progress" ? "border-yellow-200 bg-yellow-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        Match {m.matchNumber}{m.courtNumber ? ` · Court ${m.courtNumber}` : ""}
                      </div>
                      <div className={`text-sm py-0.5 ${m.winnerEntryId === m.player1EntryId ? "font-bold text-green-700" : ""}`}>
                        {getEntryName(m.player1EntryId)}
                      </div>
                      <div className="text-xs text-gray-300 my-0.5">vs</div>
                      <div className={`text-sm py-0.5 ${m.winnerEntryId === m.player2EntryId ? "font-bold text-green-700" : ""}`}>
                        {getEntryName(m.player2EntryId)}
                      </div>
                      {m.winMethod && <div className="text-xs text-gray-400 mt-1">Won by {m.winMethod}</div>}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
