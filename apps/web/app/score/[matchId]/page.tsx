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

interface MatchPoint {
  id: string;
  scoringEntryId: string;
  pointType: string;
  isHansoku: boolean;
  isEncho: boolean;
  pointOrder: number;
}

const POINT_TYPES = [
  { value: "men", label: "面", sublabel: "Men" },
  { value: "kote", label: "小手", sublabel: "Kote" },
  { value: "do", label: "胴", sublabel: "Do" },
  { value: "tsuki", label: "突き", sublabel: "Tsuki" },
];

export default function ScoringPage() {
  const params = useParams();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [points, setPoints] = useState<MatchPoint[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [isEncho, setIsEncho] = useState(false);
  const [scoring, setScoring] = useState(false);

  const load = useCallback(async () => {
    const data = await api(`/matches/${matchId}`);
    setMatch(data.match);
    setPoints(data.points);
  }, [matchId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  if (!match) return <div className="p-8 text-center">Loading match...</div>;

  const p1Points = points.filter(
    (p) => p.scoringEntryId === match.player1EntryId && !p.isHansoku
  );
  const p2Points = points.filter(
    (p) => p.scoringEntryId === match.player2EntryId && !p.isHansoku
  );

  async function recordScore(pointType: string) {
    if (!selectedPlayer || !match || scoring) return;
    const entryId = selectedPlayer === 1 ? match.player1EntryId : match.player2EntryId;
    if (!entryId) return;

    setScoring(true);
    try {
      await api(`/matches/${matchId}/score`, {
        method: "POST",
        body: JSON.stringify({ scoringEntryId: entryId, pointType, isEncho }),
      });
      await load();
      setSelectedPlayer(null);
    } finally {
      setScoring(false);
    }
  }

  async function recordHansoku() {
    if (!selectedPlayer || !match || scoring) return;
    const againstEntryId = selectedPlayer === 1 ? match.player1EntryId : match.player2EntryId;
    const scoringEntryId = selectedPlayer === 1 ? match.player2EntryId : match.player1EntryId;
    if (!againstEntryId || !scoringEntryId) return;

    setScoring(true);
    try {
      await api(`/matches/${matchId}/score`, {
        method: "POST",
        body: JSON.stringify({
          scoringEntryId,
          pointType: "hansoku",
          isHansoku: true,
          hansokuAgainstEntryId: againstEntryId,
          isEncho,
        }),
      });
      await load();
      setSelectedPlayer(null);
    } finally {
      setScoring(false);
    }
  }

  async function undoLastScore() {
    await api(`/matches/${matchId}/undo-score`, { method: "POST" });
    await load();
  }

  async function startMatch() {
    await api(`/matches/${matchId}/start`, { method: "POST" });
    await load();
  }

  async function completeWithHantei(winnerEntryId: string) {
    await api(`/matches/${matchId}/complete`, {
      method: "POST",
      body: JSON.stringify({ winnerEntryId, winMethod: "hantei" }),
    });
    await load();
  }

  if (match.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-700 mb-4">Match Complete</h1>
          <p className="text-lg">Won by {match.winMethod}</p>
        </div>
      </div>
    );
  }

  if (match.status === "scheduled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Match {match.matchNumber}</h1>
          {match.courtNumber && <p className="text-gray-500 mb-6">Court {match.courtNumber}</p>}
          <button
            onClick={startMatch}
            className="rounded-xl bg-blue-600 px-12 py-4 text-xl text-white font-bold hover:bg-blue-700"
          >
            Start Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">Match {match.matchNumber}</span>
          {match.courtNumber && <span className="text-sm text-gray-400 ml-2">· Court {match.courtNumber}</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEncho(!isEncho)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              isEncho ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {isEncho ? "ENCHO" : "Regular"}
          </button>
          <button
            onClick={undoLastScore}
            disabled={points.length === 0}
            className="rounded px-3 py-1 text-xs bg-red-100 text-red-600 disabled:opacity-30"
          >
            Undo
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex-1 flex">
        <button
          onClick={() => setSelectedPlayer(selectedPlayer === 1 ? null : 1)}
          className={`flex-1 flex flex-col items-center justify-center p-4 border-r transition-colors ${
            selectedPlayer === 1 ? "bg-blue-100" : "bg-white"
          }`}
        >
          <div className="text-6xl font-bold mb-2">{p1Points.length}</div>
          <div className="text-sm text-gray-600">Player 1</div>
          <div className="flex gap-1 mt-2">
            {p1Points.map((p) => (
              <span key={p.id} className="text-xs bg-blue-200 rounded px-1">{p.pointType}</span>
            ))}
          </div>
        </button>

        <button
          onClick={() => setSelectedPlayer(selectedPlayer === 2 ? null : 2)}
          className={`flex-1 flex flex-col items-center justify-center p-4 transition-colors ${
            selectedPlayer === 2 ? "bg-red-100" : "bg-white"
          }`}
        >
          <div className="text-6xl font-bold mb-2">{p2Points.length}</div>
          <div className="text-sm text-gray-600">Player 2</div>
          <div className="flex gap-1 mt-2">
            {p2Points.map((p) => (
              <span key={p.id} className="text-xs bg-red-200 rounded px-1">{p.pointType}</span>
            ))}
          </div>
        </button>
      </div>

      {/* Score Buttons */}
      {selectedPlayer && (
        <div className="bg-white border-t p-4">
          <p className="text-center text-sm text-gray-500 mb-3">Scoring for Player {selectedPlayer}</p>
          <div className="grid grid-cols-2 gap-3">
            {POINT_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => recordScore(pt.value)}
                disabled={scoring}
                className="rounded-xl bg-blue-600 py-4 text-white text-center hover:bg-blue-700 disabled:opacity-50"
              >
                <div className="text-2xl">{pt.label}</div>
                <div className="text-xs opacity-75">{pt.sublabel}</div>
              </button>
            ))}
          </div>
          <button
            onClick={recordHansoku}
            disabled={scoring}
            className="w-full mt-3 rounded-xl bg-yellow-500 py-3 text-white font-bold hover:bg-yellow-600 disabled:opacity-50"
          >
            反則 Hansoku (against Player {selectedPlayer})
          </button>
        </div>
      )}

      {/* Hantei buttons */}
      {!selectedPlayer && (
        <div className="bg-white border-t p-4">
          <p className="text-center text-sm text-gray-500 mb-2">Judge Decision (Hantei)</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => match.player1EntryId && completeWithHantei(match.player1EntryId)}
              className="rounded-xl border-2 border-blue-300 py-3 text-blue-700 font-bold hover:bg-blue-50"
            >
              Player 1 Wins
            </button>
            <button
              onClick={() => match.player2EntryId && completeWithHantei(match.player2EntryId)}
              className="rounded-xl border-2 border-red-300 py-3 text-red-700 font-bold hover:bg-red-50"
            >
              Player 2 Wins
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
