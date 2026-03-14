import React, { useState } from 'react';
import { Team, Golfer, RoundScores } from '../types';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface GameLeaderboardProps {
  teams: Team[];
  onGolferClick?: (golfer: Golfer) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const GameLeaderboard: React.FC<GameLeaderboardProps> = ({ teams, onGolferClick, onRefresh, loading }) => {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const formatScore = (score: number | string | null | undefined) => {
    if (score === null || score === undefined || score === '-') return '-';
    const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
    if (isNaN(numScore)) return '-';
    if (numScore === 0) return 'E';
    return numScore > 0 ? `+${numScore}` : `${numScore}`;
  };

  const getScoreColorClass = (score: number | string | null | undefined, isCut: boolean): string => {
    if (isCut) return 'text-gray-400';
    if (score === null || score === undefined || score === '-') return 'text-gray-400';
    const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
    if (isNaN(numScore)) return 'text-gray-400';
    if (numScore < 0) return 'text-red-600';
    return 'text-gray-800';
  };

  const getPlayerToPar = (golfer: Golfer): number | null => {
    if (!golfer.roundScores) return null;
    const scores = (Object.values(golfer.roundScores) as (number | string | null | undefined)[])
      .map(s => s == null ? null : typeof s === 'string' ? parseInt(s, 10) : s)
      .filter((s): s is number => s !== null && !isNaN(s));
    return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) : null;
  };

  // Calculate team score for a specific round (sum of 2 lowest player scores)
  const calculateTeamRoundScore = (team: Team, round: 1 | 2 | 3 | 4): number | null => {
    if (!team.roster || team.roster.length === 0) return null;

    const roundKey = `r${round}` as keyof RoundScores;
    const scores = team.roster
      .map(golfer => {
        const score = golfer.roundScores?.[roundKey];
        if (score === null || score === undefined) return null;
        return typeof score === 'string' ? parseInt(score, 10) : score;
      })
      .filter((score): score is number => score !== null && !isNaN(score));

    if (scores.length < 2) return null; // Need at least 2 scores

    // Sort ascending and take 2 lowest scores
    scores.sort((a, b) => a - b);
    return scores[0] + scores[1];
  };

  // Calculate all round scores for a team
  const calculateTeamRoundScores = (team: Team): { r1: number | null; r2: number | null; r3: number | null; r4: number | null } => {
    return {
      r1: calculateTeamRoundScore(team, 1),
      r2: calculateTeamRoundScore(team, 2),
      r3: calculateTeamRoundScore(team, 3),
      r4: calculateTeamRoundScore(team, 4),
    };
  };

  // Calculate total team score (sum of all daily scores)
  const calculateTeamScore = (team: Team): number | null => {
    const roundScores = calculateTeamRoundScores(team);
    const validScores = [roundScores.r1, roundScores.r2, roundScores.r3, roundScores.r4]
      .filter((score): score is number => score !== null);

    if (validScores.length === 0) return null;
    return validScores.reduce((sum, score) => sum + score, 0);
  };

  const isPlayerCut = (golfer: Golfer): boolean => {
    const pos = typeof golfer.position === 'string' ? golfer.position.toUpperCase() : golfer.position;
    const status = typeof golfer.status === 'string' ? golfer.status.toUpperCase() : null;
    return pos === 'CUT' || pos === 'WD' || pos === 'DQ' || status === 'CUT' || status === 'WD' || status === 'DQ';
  };

  const isTeamCut = (team: Team): boolean => {
    if (!team.roster || team.roster.length === 0) return false;
    // Team needs at least 2 players to make the cut to stay in contention
    const playersMadeCut = team.roster.filter(golfer => !isPlayerCut(golfer)).length;
    return playersMadeCut < 2;
  };

  const sortedTeams = [...teams].sort((a, b) => {
    const aIsCut = isTeamCut(a);
    const bIsCut = isTeamCut(b);

    if (aIsCut && !bIsCut) return 1;
    if (!aIsCut && bIsCut) return -1;

    const aScore = calculateTeamScore(a);
    const bScore = calculateTeamScore(b);

    if (aScore === null && bScore === null) return 0;
    if (aScore === null) return 1;
    if (bScore === null) return -1;

    return aScore - bScore;
  });

  // Find the index where cut teams begin (for the cut line indicator)
  const cutLineIndex = sortedTeams.findIndex(team => isTeamCut(team));

  // Find the lowest (winning) score for each round across all teams
  const getDailyWinners = (): { r1: number | null; r2: number | null; r3: number | null; r4: number | null } => {
    const allRoundScores = teams.map(team => calculateTeamRoundScores(team));

    const getLowestScore = (scores: (number | null)[]): number | null => {
      const validScores = scores.filter((s): s is number => s !== null);
      if (validScores.length === 0) return null;
      return Math.min(...validScores);
    };

    return {
      r1: getLowestScore(allRoundScores.map(s => s.r1)),
      r2: getLowestScore(allRoundScores.map(s => s.r2)),
      r3: getLowestScore(allRoundScores.map(s => s.r3)),
      r4: getLowestScore(allRoundScores.map(s => s.r4)),
    };
  };

  const dailyWinners = getDailyWinners();

  // Check if a team's round score is the daily winner
  const isDailyWinner = (score: number | null, winningScore: number | null): boolean => {
    if (score === null || winningScore === null) return false;
    return score === winningScore;
  };

  const toggleExpand = (teamId: string) => {
    setExpandedTeamId(expandedTeamId === teamId ? null : teamId);
  };

  return (
    <div className="relative">
      <div className="relative pb-3 border-b-4 border-yellow-500 mb-3 mx-2 flex items-center justify-center min-h-[48px]">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-yellow-400 tracking-widest uppercase drop-shadow-md text-center m-0">
          Leaderboard
        </h2>
        {onRefresh && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <button
              onClick={onRefresh}
              className="flex items-center bg-[#073017] hover:bg-[#052210] text-yellow-400 border border-yellow-500 px-3 py-1.5 rounded-md font-bold text-sm transition-colors border-opacity-50"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        )}
      </div>
      <div className="card w-full shadow-inner overflow-hidden border border-gray-300 relative p-0 overflow-x-auto">
        <div className="min-w-full">
          <table className="w-full text-sm text-left text-gray-800">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-semibold border-b border-gray-300">
              <tr>
                <th className="px-2 sm:px-4 py-3 sm:py-4">Pos</th>
                <th className="px-2 sm:px-4 py-3 sm:py-4">Team</th>
                <th className="px-1 sm:px-2 py-3 sm:py-4 text-center">R1</th>
                <th className="px-1 sm:px-2 py-3 sm:py-4 text-center">R2</th>
                <th className="px-1 sm:px-2 py-3 sm:py-4 text-center">R3</th>
                <th className="px-1 sm:px-2 py-3 sm:py-4 text-center">R4</th>
                <th className="px-2 sm:px-4 py-3 sm:py-4 text-center">Total</th>
                <th className="px-1 sm:px-2 py-3 sm:py-4 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedTeams.map((team, index) => {
                const isExpanded = expandedTeamId === team.id;
                const isCut = isTeamCut(team);
                const teamScore = calculateTeamScore(team);
                const showCutLine = cutLineIndex !== -1 && index === cutLineIndex;

                return (
                  <React.Fragment key={team.id}>
                    {/* Cut Line Indicator */}
                    {showCutLine && (
                      <tr className="bg-red-50 border-y border-red-100">
                        <td colSpan={8} className="py-2 px-6">
                          <div className="flex items-center justify-center">
                            <div className="flex-1 border-t-2 border-red-200 border-dashed"></div>
                            <span className="px-4 text-red-600 text-xs font-bold uppercase tracking-wider">
                              Projected Cut
                            </span>
                            <div className="flex-1 border-t-2 border-red-200 border-dashed"></div>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => toggleExpand(team.id)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${isCut ? 'bg-gray-50 text-gray-400 opacity-80' : 'bg-white'}`}
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 font-medium">
                        {isCut ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            CUT
                          </span>
                        ) : (
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full font-bold shadow-sm border ${index === 0 ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {index + 1}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-gray-100 mr-2 sm:mr-3 shadow-sm border border-gray-200 flex-shrink-0">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full bg-green-800 text-white font-bold text-[10px] sm:text-xs uppercase uppercase">
                                {team.name.substring(0, 2)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className={`font-bold font-serif text-sm sm:text-lg tracking-wide ${isCut ? 'text-gray-400' : 'text-gray-900'}`}>{team.name}</div>
                          </div>
                        </div>
                      </td>
                      {/* Round Scores */}
                      {(() => {
                        const roundScores = calculateTeamRoundScores(team);
                        const isR1Winner = !isCut && isDailyWinner(roundScores.r1, dailyWinners.r1);
                        const isR2Winner = !isCut && isDailyWinner(roundScores.r2, dailyWinners.r2);
                        const isR3Winner = !isCut && isDailyWinner(roundScores.r3, dailyWinners.r3);
                        const isR4Winner = !isCut && isDailyWinner(roundScores.r4, dailyWinners.r4);

                        return (
                          <>
                            <td className={`px-1 sm:px-2 py-3 sm:py-4 text-center font-bold text-base sm:text-lg font-serif ${isR1Winner ? 'bg-yellow-50' : ''}`}>
                              <span className={`${isR1Winner ? 'text-yellow-600' : getScoreColorClass(roundScores.r1, isCut)}`}>
                                {formatScore(roundScores.r1)}
                              </span>
                            </td>
                            <td className={`px-1 sm:px-2 py-3 sm:py-4 text-center font-bold text-base sm:text-lg font-serif ${isR2Winner ? 'bg-yellow-50' : ''}`}>
                              <span className={`${isR2Winner ? 'text-yellow-600' : getScoreColorClass(roundScores.r2, isCut)}`}>
                                {formatScore(roundScores.r2)}
                              </span>
                            </td>
                            <td className={`px-1 sm:px-2 py-3 sm:py-4 text-center font-bold text-base sm:text-lg font-serif ${isR3Winner ? 'bg-yellow-50' : ''}`}>
                              <span className={`${isR3Winner ? 'text-yellow-600' : getScoreColorClass(roundScores.r3, isCut)}`}>
                                {formatScore(roundScores.r3)}
                              </span>
                            </td>
                            <td className={`px-1 sm:px-2 py-3 sm:py-4 text-center font-bold text-base sm:text-lg font-serif ${isR4Winner ? 'bg-yellow-50' : ''}`}>
                              <span className={`${isR4Winner ? 'text-yellow-600' : getScoreColorClass(roundScores.r4, isCut)}`}>
                                {formatScore(roundScores.r4)}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                      <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-lg sm:text-xl font-serif tracking-tight ${getScoreColorClass(teamScore, isCut)}`}>
                        {formatScore(teamScore)}
                      </td>
                      <td className="px-1 sm:px-2 py-3 sm:py-4 text-center">
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-100/50 border-b border-gray-200">
                        <td colSpan={8} className="px-2 sm:px-4 py-3 sm:py-4">
                          <div className="bg-white rounded border border-gray-200 p-2 sm:p-4 shadow-sm">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Player Performance</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {team.roster && (() => {
                                const sorted = [...team.roster].sort((a, b) => {
                                  const aHasScore = Object.values(a.roundScores ?? {}).some(s => s !== null && s !== undefined);
                                  const bHasScore = Object.values(b.roundScores ?? {}).some(s => s !== null && s !== undefined);
                                  if (aHasScore && !bHasScore) return -1;
                                  if (!aHasScore && bHasScore) return 1;
                                  return 0;
                                });
                                const firstUnstartedIdx = sorted.findIndex(p => !Object.values(p.roundScores ?? {}).some(s => s !== null && s !== undefined));
                                return sorted.map((player, playerIdx) => {
                                const playerToPar = getPlayerToPar(player);
                                const playerIsCut = isPlayerCut(player);
                                const playerHasScore = Object.values(player.roundScores ?? {}).some(s => s !== null && s !== undefined);

                                return (
                                  <React.Fragment key={player.id}>
                                    {firstUnstartedIdx !== -1 && playerIdx === firstUnstartedIdx && (
                                      <div className="flex items-center gap-2 py-1">
                                        <div className="flex-1 border-t border-dashed border-blue-200"></div>
                                        <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Not yet started</span>
                                        <div className="flex-1 border-t border-dashed border-blue-200"></div>
                                      </div>
                                    )}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onGolferClick?.(player);
                                    }}
                                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer hover:shadow-md transition-all duration-200 ${!playerHasScore ? 'bg-blue-50/30 border-blue-100 hover:bg-blue-50' : playerIsCut ? 'bg-gray-50 border-gray-200 hover:bg-red-50' : 'bg-white border-gray-200 hover:border-yellow-400/60 hover:bg-yellow-50/30'}`}
                                  >
                                    {/* Player Info */}
                                    <div className="flex items-center space-x-3 min-w-[140px]">
                                      <span className={`text-sm font-medium font-serif ${playerIsCut ? 'text-gray-400 line-through' : 'text-gray-900 hover:text-green-800'}`}>{player.name}</span>
                                      {playerIsCut && <span className="text-[10px] text-red-600 border border-red-200 font-bold bg-red-50 px-1 rounded shadow-sm">{player.position}</span>}
                                      <span className="text-[10px] text-gray-500 border border-gray-200 bg-gray-50 px-1.5 py-0.5 rounded shadow-sm">#{player.rank}</span>
                                    </div>

                                    {/* Round Scores */}
                                    <div className="flex items-center space-x-1 border-l border-r border-gray-200 px-2 sm:px-4 mx-1 sm:mx-3">
                                      {([1, 2, 3, 4] as const).map(round => {
                                        const roundKey = `r${round}` as keyof RoundScores;
                                        const teeTimeKey = `r${round}` as keyof import('../types').RoundTeeTimes;
                                        const roundScore = player.roundScores?.[roundKey];
                                        const teeTime = player.roundTeeTimes?.[teeTimeKey];

                                        const hasScore = roundScore !== null && roundScore !== undefined;
                                        return (
                                          <div key={round} className="text-center w-14">
                                            <div className="text-[9px] text-gray-400 font-bold tracking-wider uppercase mb-0.5">R{round}</div>
                                            {hasScore ? (
                                              <>
                                                <div className={`text-xs sm:text-sm font-bold font-serif ${getScoreColorClass(roundScore, playerIsCut)}`}>
                                                  {formatScore(roundScore)}
                                                </div>
                                                {teeTime && (
                                                  <div className="text-[8px] text-gray-400 mt-0.5 uppercase tracking-tighter truncate w-full" title={teeTime}>
                                                    {teeTime}
                                                  </div>
                                                )}
                                              </>
                                            ) : teeTime ? (
                                              <div className="text-[9px] text-blue-500 font-medium tracking-tighter truncate w-full leading-tight mt-0.5" title={teeTime}>
                                                {teeTime}
                                              </div>
                                            ) : (
                                              <div className="text-xs text-gray-300 font-serif">-</div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Current Stats */}
                                    <div className="flex items-center space-x-5">
                                      <div className="text-center w-8">
                                        <div className="text-[9px] text-gray-400 font-bold tracking-wider uppercase mb-0.5">Pos</div>
                                        <div className={`text-sm font-bold ${playerIsCut ? 'text-gray-400' : 'text-gray-700'}`}>
                                          {player.position || '-'}
                                        </div>
                                      </div>
                                      <div className="text-center w-8">
                                        <div className="text-[9px] text-gray-400 font-bold tracking-wider uppercase mb-0.5">Thru</div>
                                        <div className={`text-sm font-bold ${playerIsCut ? 'text-gray-400' : 'text-gray-700'}`}>
                                          {player.thru || '-'}
                                        </div>
                                      </div>
                                      <div className="w-14 text-center">
                                        <div className="text-[9px] text-gray-400 font-bold tracking-wider uppercase mb-0.5">Total</div>
                                        <div className={`text-base sm:text-lg font-bold font-serif ${getScoreColorClass(playerToPar, playerIsCut)}`}>
                                          {formatScore(playerToPar)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  </React.Fragment>
                                );
                                });
                              })()}
                            </div>
                            <div className="mt-4 text-[11px] text-gray-500 italic flex items-center">
                              <span className="text-yellow-600 font-bold text-lg mr-1 leading-none">*</span> Yellow text styling indicates the active daily winner. Default daily team scores aggregate the 2 lowest player scores.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GameLeaderboard;
