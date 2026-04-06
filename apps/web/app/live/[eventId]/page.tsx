"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Bracket {
  id: string;
  name: string;
  format: string;
  status: string;
}

interface Match {
  id: string;
  bracketId: string;
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
  entry: { id: string; seedNumber: number | null };
  registration: { participantName: string; participantRank: string | null } | null;
}

export default function LiveEventPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selectedBracketId, setSelectedBracketId] = useState<string>("");
  const [matchList, setMatches] = useState<Match[]>([]);
  const [entryMap, setEntryMap] = useState<Map<string, Entry>>(new Map());

  const loadBrackets = useCallback(async () => {
    const data = await api(`/brackets/event/${eventId}`);
    setBrackets(data);
    if (data.length > 0 && !selectedBracketId) {
      setSelectedBracketId(data[0].id);
    }
  }, [eventId, selectedBracketId]);

  const loadBracketData = useCallback(async () => {
    if (!selectedBracketId) return;
    const [m, e] = await Promise.all([
      api(`/brackets/${selectedBracketId}/matches`),
      api(`/brackets/${selectedBracketId}/entries`),
    ]);
    setMatches(m);
    setEntryMap(new Map(e.map((entry: Entry) => [entry.entry.id, entry])));
  }, [selectedBracketId]);

  useEffect(() => { loadBrackets(); }, [loadBrackets]);

  useEffect(() => {
    loadBracketData();
    const interval = setInterval(loadBracketData, 5000);
    return () => clearInterval(interval);
  }, [loadBracketData]);

  function getEntryName(entryId: string | null): string {
    if (!entryId) return "—";
    const entry = entryMap.get(entryId);
    return entry?.registration?.participantName ?? "TBD";
  }

  const rounds = new Map<number, Match[]>();
  for (const m of matchList) {
    const round = rounds.get(m.roundNumber) ?? [];
    round.push(m);
    rounds.set(m.roundNumber, round);
  }

  const inProgressMatches = matchList.filter((m) => m.status === "in_progress");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Live Brackets</h1>
        <div className="flex gap-2">
          {brackets.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBracketId(b.id)}
              className={`rounded px-3 py-1 text-sm ${
                selectedBracketId === b.id ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {inProgressMatches.length > 0 && (
        <div className="bg-yellow-600 px-6 py-3">
          <p className="text-sm font-medium">
            {inProgressMatches.length} match{inProgressMatches.length > 1 ? "es" : ""} in progress
          </p>
        </div>
      )}

      <div className="overflow-x-auto p-6">
        <div className="flex gap-8 min-w-max">
          {[...rounds.entries()]
            .sort(([a], [b]) => a - b)
            .map(([roundNum, roundMatches]) => (
              <div key={roundNum} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-gray-400 text-center">Round {roundNum}</h3>
                {roundMatches.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3 min-w-[220px] ${
                      m.status === "in_progress"
                        ? "bg-yellow-900 border border-yellow-600 animate-pulse"
                        : m.status === "completed"
                        ? "bg-gray-800 border border-green-800"
                        : "bg-gray-800 border border-gray-700"
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      Match {m.matchNumber}
                      {m.courtNumber ? ` · Court ${m.courtNumber}` : ""}
                      {m.status === "in_progress" && <span className="ml-2 text-yellow-400">LIVE</span>}
                    </div>
                    <div className={`text-sm py-1 ${m.winnerEntryId === m.player1EntryId ? "text-green-400 font-bold" : "text-gray-200"}`}>
                      {getEntryName(m.player1EntryId)}
                    </div>
                    <div className={`text-sm py-1 ${m.winnerEntryId === m.player2EntryId ? "text-green-400 font-bold" : "text-gray-200"}`}>
                      {getEntryName(m.player2EntryId)}
                    </div>
                    {m.winMethod && <div className="text-xs text-gray-500 mt-1 capitalize">{m.winMethod}</div>}
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
