import { Team, Golfer, RoundScores } from '../types';

/**
 * Shared scoring utilities — identical to the logic inside GameLeaderboard.tsx.
 * Used by both GameLeaderboard (display) and buildSeasonRecordFromTeams (finalize).
 * Any change here affects both features equally, ensuring they always match.
 */

/** Returns true if the golfer is CUT, WD, or DQ — mirrors GameLeaderboard.isPlayerCut */
export function isPlayerCut(golfer: Golfer): boolean {
  const pos = typeof golfer.position === 'string' ? golfer.position.toUpperCase() : golfer.position;
  const status = typeof golfer.status === 'string' ? golfer.status.toUpperCase() : null;
  return pos === 'CUT' || pos === 'WD' || pos === 'DQ' || status === 'CUT' || status === 'WD' || status === 'DQ';
}

/** Returns true if the team did NOT have at least 2 players survive the cut — mirrors GameLeaderboard.isTeamCut */
export function isTeamCut(team: Team): boolean {
  if (!team.roster || team.roster.length === 0) return false;
  const playersMadeCut = team.roster.filter(g => !isPlayerCut(g)).length;
  return playersMadeCut < 2;
}

/** Calculate team score for a specific round (2 lowest valid player scores) — mirrors GameLeaderboard.calculateTeamRoundScore */
export function calculateTeamRoundScore(team: Team, round: 1 | 2 | 3 | 4): number | null {
  if (!team.roster || team.roster.length === 0) return null;
  const roundKey = `r${round}` as keyof RoundScores;
  const scores = team.roster
    .map(golfer => {
      const score = golfer.roundScores?.[roundKey];
      if (score === null || score === undefined) return null;
      return typeof score === 'string' ? parseInt(score, 10) : score;
    })
    .filter((score): score is number => score !== null && !isNaN(score));
  if (scores.length < 2) return null;
  scores.sort((a, b) => a - b);
  return scores[0] + scores[1];
}

/** Calculate all 4 round scores for a team — mirrors GameLeaderboard.calculateTeamRoundScores */
export function calculateTeamRoundScores(team: Team): { r1: number | null; r2: number | null; r3: number | null; r4: number | null } {
  return {
    r1: calculateTeamRoundScore(team, 1),
    r2: calculateTeamRoundScore(team, 2),
    r3: calculateTeamRoundScore(team, 3),
    r4: calculateTeamRoundScore(team, 4),
  };
}

/** Calculate the total team score (sum of all round scores) — mirrors GameLeaderboard.calculateTeamScore */
export function calculateTeamScore(team: Team): number | null {
  const scores = calculateTeamRoundScores(team);
  const valid = [scores.r1, scores.r2, scores.r3, scores.r4].filter((s): s is number => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, s) => sum + s, 0);
}

/** Find the lowest (winning) score for each round across all teams — mirrors GameLeaderboard.getDailyWinners */
export function getDailyWinners(teams: Team[]): { r1: number | null; r2: number | null; r3: number | null; r4: number | null } {
  const allScores = teams.map(team => calculateTeamRoundScores(team));
  const min = (arr: (number | null)[]): number | null => {
    const valid = arr.filter((s): s is number => s !== null);
    return valid.length > 0 ? Math.min(...valid) : null;
  };
  return {
    r1: min(allScores.map(s => s.r1)),
    r2: min(allScores.map(s => s.r2)),
    r3: min(allScores.map(s => s.r3)),
    r4: min(allScores.map(s => s.r4)),
  };
}
