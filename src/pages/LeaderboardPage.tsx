import React, { useState, useEffect } from 'react';
import { Team, Golfer, RoundScores, FantasyGolfPlayerRoundResult } from '../types';
import { Trophy, RefreshCw, X, Lock } from 'lucide-react';
import { useYear } from '../contexts/YearContext';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import GameLeaderboard from '../components/GameLeaderboard';
import PlayerScorecardViewer from '../components/PlayerScorecardViewer';
import FinalizeSeasonModal from '../components/FinalizeSeasonModal';
import { fetchTeams } from '../services/teamService';
import { checkIfFantasyGolfResultsNeedsSync, saveFantasyGolfResults } from '../services/rapidApiService';
import useAdmin from '../hooks/useAdmin';

interface PlayerRoundData {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string | number | null;
  status?: string | null;
  totalToPar: string | number | null;
  thru: string | number | null;
  strokes: number | null;
  roundId: number;
  teamId: string;
  teamName: string;
  ownerId: string;
  ownerName: string;
  teeTime: string | null;
}

const LeaderboardPage: React.FC = () => {
  const { year } = useYear();
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['leaderboard', year],
    queryFn: async () => {
      // Fetch base teams and rosters from Firestore first
      const baseTeams = await fetchTeams(year);

      // Check for active tournament settings to see if we need a sync
      const settingsDocRef = doc(db, 'Settings', 'autosync');
      const settingsSnap = await getDoc(settingsDocRef);

      let syncTournId = '';
      let tournamentEndDate: string | null = null;
      let tournamentName: string | null = null;

      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        if (settings.activeYear === year && settings.activeTournamentId) {
          syncTournId = settings.activeTournamentId;
        }
      }

      // Fetch tournament end date from PGA-Schedule (for Finalize Season eligibility)
      if (syncTournId) {
        try {
          const scheduleSnap = await getDocs(
            query(collection(db, 'PGA-Schedule'), where('tournId', '==', syncTournId), where('year', '==', year))
          );
          if (!scheduleSnap.empty) {
            const d = scheduleSnap.docs[0].data();
            const raw = d.endDate;
            if (raw) {
              if (typeof raw === 'string') tournamentEndDate = raw;
              else if (typeof raw.toDate === 'function') tournamentEndDate = raw.toDate().toISOString();
              else if (typeof raw.seconds === 'number') tournamentEndDate = new Date(raw.seconds * 1000).toISOString();
            }
            tournamentName = d.tournName || d.name || null;
          }
        } catch {
          // Best-effort; finalize button will remain hidden
        }
      }

      if (syncTournId) {
        // Unconditionally sync all 4 rounds to ensure the latest data is present
        // Bypassing the "activeRound" constraint to prevent data bottlenecks
        for (let r = 1; r <= 4; r++) {
          try {
            const needed = await checkIfFantasyGolfResultsNeedsSync(syncTournId, year, r);
            if (needed) {
              console.log(`Sync needed: Updating FantasyGolf-Results from Tournament-Results for tournId ${syncTournId}, round ${r}`);
              await saveFantasyGolfResults(syncTournId, year, r);
            }
          } catch (e) {
            console.error(`Error syncing round ${r} on page load:`, e);
          }
        }
      }

      // Fetch all FantasyGolf-Results for this year (and active tournament when configured)
      const resultsRef = collection(db, "FantasyGolf-Results");
      const resultsQueries = syncTournId
        ? [
          query(
            resultsRef,
            where("tournId", "==", syncTournId),
            where("year", "==", year)
          ),
          query(
            resultsRef,
            where("tournId", "==", syncTournId),
            where("year", "==", String(year))
          ),
        ]
        : [
          query(
            resultsRef,
            where("year", "==", year)
          ),
          query(
            resultsRef,
            where("year", "==", String(year))
          ),
        ];

      const resultsDocs: any[] = [];
      {
        const seenIds = new Set<string>();
        for (const q of resultsQueries) {
          const snap = await getDocs(q);
          snap.forEach((docSnap) => {
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              resultsDocs.push(docSnap);
            }
          });
        }
      }


      // Fetch TeeTimes collection as primary tee time source
      const teeTimesMap = new Map<string, Record<string, string | null>>();
      if (syncTournId) {
        try {
          const ttSnap = await getDocs(
            query(collection(db, 'TeeTimes'),
              where('tournId', '==', syncTournId),
              where('year', '==', year))
          );
          ttSnap.forEach(docSnap => {
            const d = docSnap.data();
            const pid = String(d.playerId || '');
            if (!pid) return;
            const map: Record<string, string | null> = {};
            if (Array.isArray(d.teeTimes)) {
              (d.teeTimes as Array<{ roundId: number; teeTime?: string }>).forEach(t => {
                if (t.roundId) map[`r${t.roundId}`] = t.teeTime || null;
              });
            }
            teeTimesMap.set(pid, map);
          });
        } catch {
          // Non-critical
        }
      }

      // Fetch Tournament-Field tee times as secondary fallback
      const fieldTeeTimeMap = new Map<string, Record<string, string | null>>();
      if (syncTournId) {
        try {
          const fieldSnap = await getDocs(
            query(collection(db, 'Tournament-Field'),
              where('tournId', '==', syncTournId),
              where('year', '==', year))
          );
          fieldSnap.forEach(doc => {
            const d = doc.data();
            const pid = String(d.playerId || doc.id);
            fieldTeeTimeMap.set(pid, {
              r1: (d.r1TeeTime ?? d.round1TeeTime ?? null) as string | null,
              r2: (d.r2TeeTime ?? d.round2TeeTime ?? null) as string | null,
              r3: (d.r3TeeTime ?? d.round3TeeTime ?? null) as string | null,
              r4: (d.r4TeeTime ?? d.round4TeeTime ?? null) as string | null,
            });
          });
        } catch {
          // Non-critical
        }
      }

      if (resultsDocs.length === 0) {
        // Enrich each roster golfer with tee times from the already-fetched maps
        // so the pre-tournament view shows tee times even before results exist.
        const enrichedTeams = baseTeams.map(team => ({
          ...team,
          roster: (team.roster || []).map((golfer: any) => {
            const pid = String(golfer.id);
            const playerTeeTimes = teeTimesMap.get(pid) ?? {};
            const fieldTimes = fieldTeeTimeMap.get(pid) ?? {};
            const roundTeeTimes: Record<string, string | null> = {};
            for (const rk of ['r1', 'r2', 'r3', 'r4']) {
              roundTeeTimes[rk] = playerTeeTimes[rk] ?? fieldTimes[rk] ?? null;
            }
            return { ...golfer, roundTeeTimes };
          }),
        }));
        return { teams: enrichedTeams, tournamentInfo: null, tournamentEndDate, tournamentName };
      }

      // Group player results by team and player, tracking all rounds
      const teamMap = new Map<string, {
        teamId: string;
        teamName: string;
        ownerId: string;
        ownerName: string;
        players: Map<string, {
          playerId: string;
          firstName: string;
          lastName: string;
          rounds: Map<number, PlayerRoundData>;
          latestRound: PlayerRoundData;
        }>;
      }>();

      let maxRound = 0;
      let tournId = '';

      resultsDocs.forEach(docSnap => {
        const data = docSnap.data();

        // Check if this is old snapshot format (has 'teams' array) or new per-player format
        if (data.teams && Array.isArray(data.teams)) {
          console.log("Found old snapshot format, skipping map processing");
          // Old snapshot format - skip, we'll handle separately
          return;
        }

        // New per-player-per-round format
        const playerData = data as FantasyGolfPlayerRoundResult;
        const teamId = playerData.teamId || docSnap.id; // Fallback to doc ID if teamId missing
        const teamName = playerData.teamName || 'Unknown Team';
        const ownerId = playerData.ownerId || '';
        const ownerName = playerData.ownerName || '';
        const playerId = playerData.playerId;
        const firstName = playerData.firstName || '';
        const lastName = playerData.lastName || '';
        const roundId = playerData.roundId;
        const teeTime = playerData.teeTime || null;

        console.log(`Processing FantasyGolf-Results doc for ${firstName} ${lastName} (Player ID: ${playerId}, Team: ${teamName}) for Round ${roundId}`);

        // Skip records without required fields
        if (!playerId || !roundId) {
          console.warn(`FantasyGolf-Results doc missing playerId or roundId. Skipping. Data:`, data);
          return;
        }

        if (roundId > maxRound) {
          maxRound = roundId;
          tournId = playerData.tournId || '';
        }

        // Get or create team entry
        if (!teamMap.has(teamId)) {
          teamMap.set(teamId, {
            teamId,
            teamName,
            ownerId,
            ownerName,
            players: new Map(),
          });
        }

        const team = teamMap.get(teamId)!;

        // Get or create player entry
        if (!team.players.has(playerId)) {
          team.players.set(playerId, {
            playerId,
            firstName,
            lastName,
            rounds: new Map(),
            latestRound: playerData as unknown as PlayerRoundData,
          });
        }

        const player = team.players.get(playerId)!;
        player.rounds.set(roundId, playerData as unknown as PlayerRoundData);
        console.log(`Set round ${roundId} data for player ${playerId}. Current roundScore relative to par: ${playerData.roundScore}, strokes: ${playerData.strokes}`);

        // Update latest round if this is more recent
        if (roundId > (player.latestRound.roundId || 0)) {
          player.latestRound = playerData as unknown as PlayerRoundData;
        }
      });

      console.log("Team Map formed from FantasyGolf-Results:", Array.from(teamMap.values()));

      // Fetch course par from the raw tournament data and validate
      let coursePar = 72;
      if (tournId && maxRound > 0) {
        try {
          const rawDocRef = doc(db, 'raw-tournament-results', `${tournId}-${year}-R${maxRound}`);
          const rawDoc = await getDoc(rawDocRef);
          if (rawDoc.exists()) {
            const d = rawDoc.data();
            const parRaw = d.par ?? d.parTotal ?? d.coursePar ?? null;
            if (parRaw != null) {
              const parNum = typeof parRaw === 'object' ? parseInt(parRaw.$numberInt, 10) : Number(parRaw);
              if (!isNaN(parNum)) {
                if (parNum !== 72) {
                  console.warn(`Course par is ${parNum}, expected 72 for Masters.`);
                }
                coursePar = parNum;
              }
            }
          }
        } catch {
          // Use default par = 72
        }
      }

      // Convert to Team[] format for GameLeaderboard
      let teamsData: Team[] = [];

      // If no new format data found, check for old snapshot format
      if (teamMap.size === 0) {
        // Try to find old snapshot format
        const snapshotDoc = resultsDocs.find(d => d.data().teams && Array.isArray(d.data().teams));
        if (snapshotDoc) {
          const snapshotData = snapshotDoc.data();
          const oldTeams = snapshotData.teams || [];

          oldTeams.forEach((teamResult: any) => {
            const roster: Golfer[] = (teamResult.players || []).map((player: any) => ({
              id: player.playerId || '',
              name: player.name || 'Unknown',
              rank: player.rank || 0,
              position: player.position ?? undefined,
              topar: player.totalToPar ?? undefined,
              thru: player.thru != null ? String(player.thru) : undefined,
              teeTime: player.teeTime || null,
              roundScores: player.roundScores || {},
              roundTeeTimes: player.roundTeeTimes || {},
            }));

            teamsData.push({
              id: teamResult.teamId || '',
              teamId: teamResult.teamId || '',
              name: teamResult.teamName || 'Unknown Team',
              ownerEmail: teamResult.ownerEmail || '',
              ownerId: '',
              logoUrl: '',
              roster,
              year,
            });
          });

          return {
            teams: teamsData,
            tournamentInfo: {
              tournId: snapshotData.tournId || '',
              maxRound: snapshotData.roundId || 0
            },
            tournamentEndDate,
            tournamentName,
          };
        }
      }

      teamsData = baseTeams.map(baseTeam => {
        // Try multiple ways to match the team data from FantasyGolf-Results against baseTeams
        const teamData =
          teamMap.get(baseTeam.id) ||
          (baseTeam.teamId ? teamMap.get(baseTeam.teamId) : undefined) ||
          Array.from(teamMap.values()).find(t => t.teamName === baseTeam.name);

        // If this team has no FantasyGolf-Results data yet, just return the base team
        if (!teamData) return baseTeam;

        // Otherwise, update the roster players with their scores
        const roster = baseTeam.roster.map(baseGolfer => {
          const playerData = teamData.players.get(baseGolfer.id);
          if (!playerData) {
            // Player hasn't started yet — still populate tee times from TeeTimes or field data
            const playerTeeTimes = teeTimesMap.get(String(baseGolfer.id));
            const fieldTimes = fieldTeeTimeMap.get(String(baseGolfer.id));
            if (playerTeeTimes && Object.keys(playerTeeTimes).length > 0) {
              const merged: Record<string, string | null> = { ...fieldTimes };
              Object.assign(merged, Object.fromEntries(
                Object.entries(playerTeeTimes).filter(([, v]) => v != null)
              ));
              return { ...baseGolfer, roundTeeTimes: merged };
            }
            if (fieldTimes) return { ...baseGolfer, roundTeeTimes: fieldTimes };
            return baseGolfer;
          }

          // Build round scores (relative to par)
          // Read roundScore string from FantasyGolf-Results (set by scorecard sync via Tournament-Results)
          // Fall back to strokes - coursePar when roundScore is unavailable
          const roundScores: RoundScores = {};
          const roundTeeTimes: any = {};
          const pid = String(playerData.playerId);
          const playerTeeTimes = teeTimesMap.get(pid) ?? {};
          const fieldTimes = fieldTeeTimeMap.get(pid);
          playerData.rounds.forEach((roundData: any, roundNum) => {
            const key = `r${roundNum}` as keyof RoundScores;
            const scoreStr = String(roundData.roundScore ?? '').trim().toUpperCase();
            let parsedScore: number | null = null;
            if (scoreStr === 'E') parsedScore = 0;
            else if (scoreStr) { const n = parseInt(scoreStr.replace('+', ''), 10); if (!isNaN(n)) parsedScore = n; }
            roundScores[key] = parsedScore ?? (roundData.strokes != null ? roundData.strokes - coursePar : null);

            const teeTimeKey = `r${roundNum}`;
            roundTeeTimes[teeTimeKey] = playerTeeTimes[teeTimeKey] || roundData.teeTime || fieldTimes?.[teeTimeKey] || null;
          });
          // Fill tee times for rounds not yet in FantasyGolf-Results (upcoming rounds)
          for (const rk of ['r1', 'r2', 'r3', 'r4']) {
            if (roundTeeTimes[rk] == null) {
              roundTeeTimes[rk] = playerTeeTimes[rk] || fieldTimes?.[rk] || null;
            }
          }

          // Infer CUT: if R3+ data exists in the tournament but this player has no R3,
          // they missed the cut (unless WD/DQ which takes priority).
          // The API returns status:"between rounds" for players who finished a round but haven't
          // started the next one. Their position field may be "WD" as a placeholder — so we must
          // guard WD/DQ detection against that status to avoid false positives.
          const latestPos = typeof playerData.latestRound.position === 'string'
            ? playerData.latestRound.position.toUpperCase() : playerData.latestRound.position;
          const latestStatus = typeof playerData.latestRound.status === 'string'
            ? playerData.latestRound.status.toUpperCase() : null;
          const isBetweenRounds = latestStatus === 'BETWEEN ROUNDS' || latestStatus === 'BETWEEN_ROUNDS';
          const isWdDq = !isBetweenRounds && (latestPos === 'WD' || latestPos === 'DQ' || latestStatus === 'WD' || latestStatus === 'DQ');
          const isCutStatus = !isWdDq && !isBetweenRounds && latestStatus === 'CUT';
          const inferredCut = !isWdDq && !isCutStatus && maxRound >= 3 && roundScores.r3 == null;

          // For position display in the non-WD/cut case, use the latest round that has actual
          // score/strokes data so between-rounds players show their real leaderboard position
          // (not the "WD" placeholder the API returns for their unstarted round).
          const latestScoredRound = ((): typeof playerData.latestRound => {
            const sorted = Array.from(playerData.rounds.entries()).sort(([a], [b]) => b - a);
            for (const [, rd] of sorted) {
              if ((rd.roundScore !== null && rd.roundScore !== undefined) ||
                  (rd.strokes !== null && rd.strokes !== undefined)) {
                return rd as typeof playerData.latestRound;
              }
            }
            return playerData.latestRound;
          })();

          const resolvedPosition = isWdDq
            ? (playerData.latestRound.position ?? baseGolfer.position)
            : (isCutStatus || inferredCut)
              ? 'CUT'
              : (latestScoredRound.position ?? baseGolfer.position);

          const resolvedThru = playerData.latestRound.thru != null
            ? String(playerData.latestRound.thru)
            : baseGolfer.thru;

          return {
            ...baseGolfer,
            position: resolvedPosition,
            status: isBetweenRounds ? (latestScoredRound.status ?? baseGolfer.status) : (playerData.latestRound.status ?? baseGolfer.status),
            topar: playerData.latestRound.totalToPar ?? baseGolfer.topar,
            thru: resolvedThru,
            teeTime: playerTeeTimes[`r${playerData.latestRound.roundId ?? maxRound}`] || playerData.latestRound.teeTime || baseGolfer.teeTime,
            roundScores,
            roundTeeTimes,
          };
        });

        // Add any players from live results that are mysteriously missing from the base roster
        // (Just in case the draft didn't sync properly but the live data has them)
        teamData.players.forEach((playerData, playerId) => {
          if (!roster.some(g => g.id === playerId)) {
            const roundScores: RoundScores = {};
            const roundTeeTimes: any = {};
            const extraTeeTimes = teeTimesMap.get(String(playerId)) ?? {};
            const extraFieldTimes = fieldTeeTimeMap.get(String(playerId));
            playerData.rounds.forEach((roundData: any, roundNum) => {
              const key = `r${roundNum}` as keyof RoundScores;
              const scoreStr = String(roundData.roundScore ?? '').trim().toUpperCase();
              let parsedScore: number | null = null;
              if (scoreStr === 'E') parsedScore = 0;
              else if (scoreStr) { const n = parseInt(scoreStr.replace('+', ''), 10); if (!isNaN(n)) parsedScore = n; }
              roundScores[key] = parsedScore ?? (roundData.strokes != null ? roundData.strokes - coursePar : null);

              const teeTimeKey = `r${roundNum}`;
              roundTeeTimes[teeTimeKey] = extraTeeTimes[teeTimeKey] || roundData.teeTime || extraFieldTimes?.[teeTimeKey] || null;
            });
            for (const rk of ['r1', 'r2', 'r3', 'r4']) {
              if (roundTeeTimes[rk] == null) {
                roundTeeTimes[rk] = extraTeeTimes[rk] || extraFieldTimes?.[rk] || null;
              }
            }

            const extraLatestPos = typeof playerData.latestRound.position === 'string'
              ? playerData.latestRound.position.toUpperCase() : playerData.latestRound.position;
            const extraLatestStatus = typeof playerData.latestRound.status === 'string'
              ? playerData.latestRound.status.toUpperCase() : null;
            const extraIsBetweenRounds = extraLatestStatus === 'BETWEEN ROUNDS' || extraLatestStatus === 'BETWEEN_ROUNDS';
            const extraIsWdDq = !extraIsBetweenRounds && (extraLatestPos === 'WD' || extraLatestPos === 'DQ' || extraLatestStatus === 'WD' || extraLatestStatus === 'DQ');
            const extraIsCutStatus = !extraIsWdDq && !extraIsBetweenRounds && extraLatestStatus === 'CUT';
            const extraInferredCut = !extraIsWdDq && !extraIsCutStatus && maxRound >= 3 && roundScores.r3 == null;
            const extraLatestScoredRound = ((): typeof playerData.latestRound => {
              const sorted = Array.from(playerData.rounds.entries()).sort(([a], [b]) => b - a);
              for (const [, rd] of sorted) {
                if ((rd.roundScore !== null && rd.roundScore !== undefined) ||
                    (rd.strokes !== null && rd.strokes !== undefined)) {
                  return rd as typeof playerData.latestRound;
                }
              }
              return playerData.latestRound;
            })();
            const extraResolvedPosition = extraIsWdDq
              ? (playerData.latestRound.position ?? undefined)
              : (extraIsCutStatus || extraInferredCut)
                ? 'CUT'
                : (extraLatestScoredRound.position ?? undefined);

            const extraResolvedThru = playerData.latestRound.thru != null
              ? String(playerData.latestRound.thru)
              : undefined;

            roster.push({
              id: playerId,
              name: `${playerData.firstName} ${playerData.lastName}`.trim() || 'Unknown',
              rank: 0,
              position: extraResolvedPosition,
              status: extraIsBetweenRounds ? (extraLatestScoredRound.status ?? undefined) : (playerData.latestRound.status ?? undefined),
              topar: playerData.latestRound.totalToPar ?? undefined,
              thru: extraResolvedThru,
              teeTime: extraTeeTimes[`r${playerData.latestRound.roundId ?? maxRound}`] || playerData.latestRound.teeTime || null,
              roundScores,
              roundTeeTimes,
            });
          }
        });

        return {
          ...baseTeam,
          roster,
        };
      });

      return {
        teams: teamsData,
        tournamentInfo: { tournId, maxRound },
        tournamentEndDate,
        tournamentName,
      };
    },
    enabled: !!year,
  });

  const teams = data?.teams || [];
  const tournamentInfo = data?.tournamentInfo || null;
  const tournamentEndDate = data?.tournamentEndDate || null;
  const tournamentName = data?.tournamentName || null;

  const { isAdmin } = useAdmin();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // Show Finalize button when: admin, all 4 rounds present, and today is past the tournament end date
  const allRoundsComplete = (tournamentInfo?.maxRound ?? 0) >= 4;
  const pastEndDate = tournamentEndDate ? new Date() > new Date(tournamentEndDate) : false;
  const canFinalize = isAdmin && allRoundsComplete && pastEndDate;

  const handleGolferClick = (golfer: Golfer) => {
    setSelectedGolfer(golfer);
  };

  const handleRefresh = async () => {
    if (isSyncing || loading) return;
    setIsSyncing(true);
    try {
      const settingsDocRef = doc(db, 'Settings', 'autosync');
      const settingsSnap = await getDoc(settingsDocRef);
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        if (settings.activeYear === year && settings.activeTournamentId) {
          const syncTournId = settings.activeTournamentId;
          // Unconditionally sync all 4 rounds to overwrite existing values
          for (let r = 1; r <= 4; r++) {
            console.log(`Manual refresh: Force syncing FantasyGolf-Results from Tournament-Results for tournId ${syncTournId}, round ${r}`);
            await saveFantasyGolfResults(syncTournId, year, r);
          }
        }
      }
      await refetch();
    } catch (error) {
      console.error("Error during manual refresh:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto px-1 sm:px-4 py-4 sm:py-8">
      {/* Header removed from here and moved inside GameLeaderboard */}

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-green-600 mb-4" />
          <p className="text-gray-600">Loading leaderboard...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">No draft found for {year}</p>
          <p className="text-sm text-gray-400 mt-2">Complete the draft to see the leaderboard.</p>
        </div>
      ) : (
        <>
          <GameLeaderboard
            teams={teams}
            onGolferClick={handleGolferClick}
            onRefresh={handleRefresh}
            loading={loading || isSyncing}
          />
          {canFinalize && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="flex items-center bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold px-6 py-3 rounded-lg shadow-md transition-colors"
              >
                <Lock className="h-5 w-5 mr-2" />
                Finalize Season
              </button>
            </div>
          )}
        </>
      )}

      {selectedGolfer && (
        tournamentInfo?.tournId ? (
          <PlayerScorecardViewer
            playerId={selectedGolfer.id}
            playerName={selectedGolfer.name}
            tournId={tournamentInfo.tournId}
            year={year}
            onClose={() => setSelectedGolfer(null)}
            roundTeeTimes={selectedGolfer.roundTeeTimes as Record<string, string | null>}
          />
        ) : (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGolfer(null)}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedGolfer.name}</h2>
                  <p className="text-sm text-gray-500">World Rank: #{selectedGolfer.rank}</p>
                </div>
                <button onClick={() => setSelectedGolfer(null)} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">Position</div>
                    <div className="text-lg font-bold text-gray-900">{selectedGolfer.position || '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">Total</div>
                    <div className={`text-lg font-bold ${selectedGolfer.topar && typeof selectedGolfer.topar === 'number' && selectedGolfer.topar < 0
                      ? 'text-red-600'
                      : selectedGolfer.topar && typeof selectedGolfer.topar === 'number' && selectedGolfer.topar > 0
                        ? 'text-gray-900'
                        : 'text-green-700'
                      }`}>
                      {selectedGolfer.topar || '-'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">Today</div>
                    <div className="text-lg font-bold text-gray-900">{selectedGolfer.today || '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">Thru</div>
                    <div className="text-lg font-bold text-gray-900">{selectedGolfer.thru || '-'}</div>
                  </div>
                  {selectedGolfer.teeTime && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase mb-1">Tee Time</div>
                      <div className="text-lg font-bold text-gray-900">{selectedGolfer.teeTime}</div>
                    </div>
                  )}
                </div>

                {selectedGolfer.country && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">Country</div>
                    <div className="text-lg font-bold text-gray-900">{selectedGolfer.country}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
      {showFinalizeModal && (
        <FinalizeSeasonModal
          onClose={() => setShowFinalizeModal(false)}
          onSaved={() => setShowFinalizeModal(false)}
          initialTournamentId={tournamentInfo?.tournId}
          initialTournamentName={tournamentName ?? undefined}
          lockedYear={year}
          leaderboardTeams={teams}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
