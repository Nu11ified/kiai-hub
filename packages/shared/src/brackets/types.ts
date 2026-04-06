export interface BracketEntry {
  id: string;
  seedNumber?: number;
  rank?: string;
  age?: number;
  region?: string;
  teamId?: string;
}

export interface GeneratedMatch {
  id: string;
  roundNumber: number;
  matchNumber: number;
  player1EntryId: string | null;
  player2EntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: "player1" | "player2" | null;
  isBye: boolean;
  isThirdPlace: boolean;
  poolNumber?: number;
}

export interface RoundRobinStanding {
  entryId: string;
  wins: number;
  losses: number;
  draws: number;
  ipponFor: number;
  ipponAgainst: number;
  ipponDiff: number;
  hanteiWins: number;
  rank: number;
  poolNumber?: number;
}

export interface MatchResult {
  matchId: string;
  winnerEntryId: string | null;
  player1Ippon: number;
  player2Ippon: number;
  player1Hansoku: number;
  player2Hansoku: number;
  winMethod: "ippon" | "hansoku" | "hantei" | "forfeit" | "disqualification" | "bye";
}

export interface KachinukiBout {
  id: string;
  matchNumber: number;
  team1EntryId: string;
  team2EntryId: string;
  team1FighterId: string;
  team2FighterId: string;
  team1Position: string;
  team2Position: string;
}

export interface CourtAssignment {
  matchId: string;
  courtNumber: number;
}

export interface ShinpanRotation {
  matchId: string;
  courtNumber: number;
  rotationGroup: number;
  shinpanIndices: number[];
}

export type ByeMethod = "random" | "by_rank" | "by_age";
export type SeedMethod = "manual" | "random" | "by_rank" | "by_region";
