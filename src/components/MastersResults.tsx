import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface MastersResultsProps {
  year: number;
  tournId: string;
  title?: string;
  onGolferClick?: (golfer: { id: string, name: string, roundTeeTimes?: Record<string, string | null> }) => void;
}

interface PlayerDisplayData {
  id: string; // Add playerId Support
  name: string;
  rank: number | string;
  totalStrokes: number;
  rounds: {
    [round: number]: number | string;
  };
  roundTeeTimes?: Record<string, string | null>;
  isCut: boolean;
  isWithdrawn: boolean;
  status: string | number | null; // "WD", "DQ", or null
}

interface FieldPlayer {
  id: string;
  name: string;
  country: string;
  rank: number;
  roundTeeTimes: Record<string, string | null>;
}

const MastersResults: React.FC<MastersResultsProps> = ({ year, tournId, title = 'The Masters Tournament', onGolferClick }) => {
  const [madeTheCut, setMadeTheCut] = useState<PlayerDisplayData[]>([]);
  const [missedTheCut, setMissedTheCut] = useState<PlayerDisplayData[]>([]);
  const [withdrawnPlayers, setWithdrawnPlayers] = useState<PlayerDisplayData[]>([]);
  const [notStartedPlayers, setNotStartedPlayers] = useState<PlayerDisplayData[]>([]);
  const [rounds, setRounds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldPlayers, setFieldPlayers] = useState<FieldPlayer[]>([]);
  const [fieldTeeTimeMap, setFieldTeeTimeMap] = useState<Map<string, Record<string, string | null>>>(new Map());

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      setFieldPlayers([]);
      try {
        const resultsCollectionRef = collection(db, 'Tournament-Results');

        // Try querying with year as number first
        let q = query(
          resultsCollectionRef,
          where('year', '==', year),
          where('tournId', '==', tournId)
        );

        // Always fetch Tournament-Field in parallel — needed for tee times in all states
        const fieldRef = collection(db, 'Tournament-Field');
        let fieldQ = query(fieldRef, where('tournId', '==', tournId), where('year', '==', year));

        let [querySnapshot, fieldSnapshot] = await Promise.all([getDocs(q), getDocs(fieldQ)]);

        // If no results, try with year as string (for backwards compatibility with existing data)
        if (querySnapshot.empty) {
          q = query(
            resultsCollectionRef,
            where('year', '==', year.toString()),
            where('tournId', '==', tournId)
          );
          querySnapshot = await getDocs(q);
        }
        if (fieldSnapshot.empty) {
          fieldSnapshot = await getDocs(
            query(fieldRef, where('tournId', '==', tournId), where('year', '==', year.toString()))
          );
        }

        // Build tee time and name maps from Tournament-Field for fallback use in all render states
        const newFieldTeeTimeMap = new Map<string, Record<string, string | null>>();
        const fieldNameMap = new Map<string, string>(); // playerId -> full name
        fieldSnapshot.forEach(doc => {
          const d = doc.data();
          const pid = String(d.playerId || doc.id);
          const tt: Record<string, string | null> = {
            r1: (d.r1TeeTime ?? d.round1TeeTime ?? null) as string | null,
            r2: (d.r2TeeTime ?? d.round2TeeTime ?? null) as string | null,
            r3: (d.r3TeeTime ?? d.round3TeeTime ?? null) as string | null,
            r4: (d.r4TeeTime ?? d.round4TeeTime ?? null) as string | null,
          };
          if (!tt.r1 && d.teeTime) tt.r1 = d.teeTime as string;
          newFieldTeeTimeMap.set(pid, tt);
          const name = d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || null;
          if (name) fieldNameMap.set(pid, name);
        });
        setFieldTeeTimeMap(newFieldTeeTimeMap);

        // Fetch TeeTimes collection as primary tee time source
        const teeTimesMap = new Map<string, Record<string, string | null>>();
        try {
          const ttSnap = await getDocs(
            query(collection(db, 'TeeTimes'),
              where('tournId', '==', tournId),
              where('year', '==', year))
          );
          ttSnap.forEach(ttDoc => {
            const d = ttDoc.data();
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
          // Non-critical — fall back to Tournament-Field tee times
        }

        if (querySnapshot.empty) {
          setMadeTheCut([]);
          setMissedTheCut([]);
          setWithdrawnPlayers([]);
          setNotStartedPlayers([]);

          // No results yet — fall back to displaying the tournament field
          if (!fieldSnapshot.empty) {
            // Fetch world rankings to sort and label the field
            const rankMap = new Map<string, number>();
            const rankingsSnapshot = await getDocs(query(collection(db, 'golf-rankings')));
            rankingsSnapshot.docs.forEach(doc => {
              const d = doc.data();
              if (d.playerId && d.rank) {
                const rankVal = typeof d.rank === 'object' ? parseInt(d.rank.$numberInt, 10) : Number(d.rank);
                rankMap.set(String(d.playerId), rankVal);
              }
            });

            const players: FieldPlayer[] = [];
            fieldSnapshot.forEach(doc => {
              const d = doc.data();
              const playerId = String(d.playerId || doc.id);
              const name = d.fullName || d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown';
              const ttEntry = teeTimesMap.get(playerId) ?? {};
              const ftEntry = newFieldTeeTimeMap.get(playerId) ?? {};
              const roundTeeTimes: Record<string, string | null> = {
                r1: ttEntry.r1 || ftEntry.r1 || null,
                r2: ttEntry.r2 || ftEntry.r2 || null,
                r3: ttEntry.r3 || ftEntry.r3 || null,
                r4: ttEntry.r4 || ftEntry.r4 || null,
              };
              players.push({
                id: playerId,
                name,
                country: d.country || '',
                rank: rankMap.get(playerId) ?? (typeof d.rank === 'number' ? d.rank : 999),
                roundTeeTimes,
              });
            });

            players.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
            setFieldPlayers(players);
          }
        } else {
          const COURSE_PAR = 72;

          // Fetch Player-Scorecards for accurate per-round scores (primary source)
          const scorecardMap = new Map<string, Map<number, number | null>>();
          try {
            const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
            const scSnap = await getDocs(
              query(
                collection(db, 'Player-Scorecards'),
                where('tournId', '==', tournId),
                where('year', 'in', [year, yearNum])
              )
            );
            scSnap.forEach(scDoc => {
              const d = scDoc.data();
              const pid = String(d.playerId ?? '');
              const rid = typeof d.roundId === 'number' ? d.roundId : parseInt(String(d.roundId ?? ''), 10);
              if (!pid || isNaN(rid)) return;
              const scoreStr = String(d.currentRoundScore ?? '').trim().toUpperCase();
              let score: number | null = null;
              if (scoreStr === 'E') score = 0;
              else if (scoreStr) { const n = parseInt(scoreStr.replace('+', ''), 10); if (!isNaN(n)) score = n; }
              if (!scorecardMap.has(pid)) scorecardMap.set(pid, new Map());
              scorecardMap.get(pid)!.set(rid, score);
            });
          } catch (e) {
            console.warn('Could not fetch Player-Scorecards, using Tournament-Results only:', e);
          }

          const playerResults: {
            [playerId: string]: {
              id: string;
              name: string;
              rounds: { [round: number]: number | string };
              roundTeeTimes: Record<string, string | null>;
              position: string | number | null;
            }
          } = {};

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const playerId = String(data.playerId ?? doc.id);
            // Resolve player name: prefer Tournament-Results fields, fall back to Tournament-Field
            const playerName = (data.firstName && data.lastName)
              ? `${data.firstName} ${data.lastName}`
              : fieldNameMap.get(playerId) || `Player ${playerId}`;
            const roundId = typeof data.roundId === 'string' ? parseInt(data.roundId, 10) : data.roundId;
            const strokes = data.strokes;
            const thru = data.thru ?? null;
            const teeTime = data.teeTime;
            const position = data.position ?? null;
            const totalToPar = data.totalToPar ?? null;
            const status = data.status ?? null;

            if (!playerResults[playerId]) {
              playerResults[playerId] = {
                id: playerId,
                name: playerName,
                rounds: {},
                roundTeeTimes: {},
                position: null,
              };
            }
            // Update name if we now have a better one (e.g. first doc had no name, later doc does)
            if (playerResults[playerId].name === `Player ${playerId}` && playerName !== `Player ${playerId}`) {
              playerResults[playerId].name = playerName;
            }

            // Compute a score if the player has started (thru > 0) OR if score data is present
            // (completed rounds may have thru=null/0 after the tournament advances past them)
            const hasScoreData = (data.roundScore != null && String(data.roundScore).trim() !== '')
                || (strokes != null && !isNaN(Number(strokes)) && Number(strokes) > 0);
            const hasStarted = hasScoreData || (thru !== null && thru !== 0 && thru !== '' && thru !== undefined);

            // Prefer scorecard currentRoundScore; fall back to Tournament-Results roundScore/strokes
            if (hasStarted) {
              let relScore: number | null = null;
              const scScore = scorecardMap.get(playerId)?.get(roundId);
              if (scScore !== undefined) {
                relScore = scScore;
              } else {
                const roundScore = data.roundScore as string | null | undefined;
                if (roundScore != null && roundScore !== '') {
                  if (roundScore.toUpperCase() === 'E') relScore = 0;
                  else { const p = parseInt(roundScore, 10); if (!isNaN(p)) relScore = p; }
                }
                if (relScore === null && strokes != null) {
                  const raw = typeof strokes === 'number' ? strokes : parseInt(String(strokes), 10);
                  if (!isNaN(raw) && raw > 0) relScore = raw - COURSE_PAR;
                }
              }
              if (relScore !== null) playerResults[playerId].rounds[roundId] = relScore;
            }

            // Tee time: TeeTimes collection → Tournament-Results → Tournament-Field
            const teeTimesEntry = teeTimesMap.get(playerId)?.[`r${roundId}`] ?? null;
            const fieldTime = newFieldTeeTimeMap.get(playerId)?.[`r${roundId}`] ?? null;
            playerResults[playerId].roundTeeTimes[`r${roundId}`] = teeTimesEntry || teeTime || fieldTime || null;

            // WD/DQ is determined solely by the position field — the API status field uses
            // "wd" for players between rounds as well as actual withdrawals, so it cannot
            // be trusted for WD classification.
            const posStr = typeof position === 'string' ? position.toUpperCase() : null;
            const statusStr = typeof status === 'string' ? status.toUpperCase() : null;
            const isWdOrDq = posStr === 'WD' || posStr === 'DQ';
            const isCutStatus = !isWdOrDq && statusStr === 'CUT';
            if (isWdOrDq) {
              playerResults[playerId].position = posStr;
            } else if (isCutStatus) {
              // status:"cut" overrides any numeric position (but WD/DQ above takes priority)
              const currentPos = typeof playerResults[playerId].position === 'string'
                ? playerResults[playerId].position!.toUpperCase() : null;
              if (currentPos !== 'WD' && currentPos !== 'DQ') {
                playerResults[playerId].position = 'CUT';
              }
            } else if (playerResults[playerId].position === null) {
              playerResults[playerId].position = position;
            }
          });

          // Populate tee times: TeeTimes collection (primary) → Tournament-Field (fallback)
          Object.values(playerResults).forEach(player => {
            const playerTeeTimes = teeTimesMap.get(String(player.id));
            const fieldTimes = newFieldTeeTimeMap.get(String(player.id));
            if (!playerTeeTimes && !fieldTimes) return;
            for (const r of [1, 2, 3, 4]) {
              const rk = `r${r}`;
              if (!player.roundTeeTimes[rk]) {
                player.roundTeeTimes[rk] = playerTeeTimes?.[rk] || fieldTimes?.[rk] || null;
              }
            }
          });

          // Always show all 4 rounds
          setRounds([1, 2, 3, 4]);

          // Cut happened when any player has actual round 3 score data
          const hasCutRounds = Object.values(playerResults).some(p => typeof p.rounds[3] === 'number');
const displayData: PlayerDisplayData[] = Object.values(playerResults).map(player => {
            const posStr = typeof player.position === 'string' ? player.position.toUpperCase() : null;
            const isWithdrawn = posStr === 'WD' || posStr === 'DQ';

            // Determine if player is cut: has rounds 1 & 2 but missing round 3 (when round 3 exists)
            // WD/DQ players bypass this check — they go to the withdrawn bucket regardless
            const hasRound1 = typeof player.rounds[1] === 'number';
            const hasRound2 = typeof player.rounds[2] === 'number';
            const hasRound3 = typeof player.rounds[3] === 'number';

            const effectiveIsWithdrawn = isWithdrawn;

            const isCut = !effectiveIsWithdrawn && (posStr === 'CUT' || (hasCutRounds && hasRound1 && hasRound2 && !hasRound3));

            // For cut players, mark rounds 3 and 4 as "CUT"
            if (isCut) {
              player.rounds[3] = 'CUT';
              player.rounds[4] = 'CUT';
            }

            // Sum relative-to-par scores across all rounds played
            const totalStrokes = Object.values(player.rounds).reduce<number>((acc, v) => {
              return typeof v === 'number' ? acc + v : acc;
            }, 0);

            return {
              id: player.id,
              name: player.name,
              rounds: player.rounds,
              roundTeeTimes: player.roundTeeTimes,
              totalStrokes: totalStrokes,
              rank: 0,
              isCut: isCut,
              isWithdrawn: effectiveIsWithdrawn,
              status: effectiveIsWithdrawn ? (posStr === 'DQ' ? 'DQ' : 'WD') : null,
            };
          });

          // A player has started if they have at least one numeric round score
          const hasScore = (p: PlayerDisplayData) => Object.values(p.rounds).some(v => typeof v === 'number');

          // Four buckets — WD/DQ > cut > scored > not started
          const withdrawn = displayData.filter(p => p.isWithdrawn);
          const missedCut = displayData.filter(p => p.isCut && !p.isWithdrawn);
          const madeCut = displayData.filter(p => !p.isCut && !p.isWithdrawn && hasScore(p));
          const notStarted = displayData.filter(p => !p.isCut && !p.isWithdrawn && !hasScore(p));

          // Sort players who made the cut by total strokes (lowest/best first)
          madeCut.sort((a, b) => a.totalStrokes - b.totalStrokes);

          // Assign ranks to players who made the cut (handle ties)
          let currentRank = 0;
          let lastScore = -Infinity;
          madeCut.forEach((player, index) => {
            if (player.totalStrokes > lastScore) {
              currentRank = index + 1;
            }
            player.rank = currentRank;
            lastScore = player.totalStrokes;
          });

          // Sort cut players by total strokes (lowest first)
          missedCut.sort((a, b) => a.totalStrokes - b.totalStrokes);
          missedCut.forEach(player => { player.rank = 'CUT'; });

          // Sort withdrawn players by total strokes (most rounds completed first)
          withdrawn.sort((a, b) => b.totalStrokes - a.totalStrokes);
          withdrawn.forEach(player => { player.rank = player.status ?? 'WD'; });

          // Not-started players — sort by tee time for the current round (r1 or r2 etc.)
          notStarted.sort((a, b) => {
            const ta = a.roundTeeTimes?.r1 ?? a.roundTeeTimes?.r2 ?? '';
            const tb = b.roundTeeTimes?.r1 ?? b.roundTeeTimes?.r2 ?? '';
            return ta.localeCompare(tb);
          });
          notStarted.forEach(player => { player.rank = '--'; });

          setMadeTheCut(madeCut);
          setMissedTheCut(missedCut);
          setWithdrawnPlayers(withdrawn);
          setNotStartedPlayers(notStarted);
        }

      } catch (err) {
        console.error('Error fetching tournament results:', err);
        setError('Failed to load results. Please try again later.');
        setMadeTheCut([]);
        setMissedTheCut([]);
        setWithdrawnPlayers([]);
        setNotStartedPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [year, tournId]);

  const totalPlayers = madeTheCut.length + missedTheCut.length + withdrawnPlayers.length;

  // Format a relative-to-par score: -3 → red "-3", 0 → green "E", +2 → "+2", 'CUT' → "CUT"
  const fmtScore = (v: number | string | undefined): React.ReactNode => {
    if (v === undefined) return null;
    if (v === 'CUT') return <span className="text-red-500 font-bold text-[10px]">CUT</span>;
    if (typeof v !== 'number') return String(v);
    if (v === 0) return <span className="text-green-700 font-bold">E</span>;
    if (v < 0) return <span className="text-red-600 font-bold">{v}</span>;
    return <span>+{v}</span>;
  };

  return (
    <div className="relative">
      <div className="relative pb-3 border-b-4 border-yellow-500 mb-4 mx-2 flex flex-col items-center justify-center min-h-[48px]">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-yellow-400 tracking-widest uppercase drop-shadow-md text-center m-0">
          {title}
        </h2>
        <p className="mt-1 text-sm text-yellow-200/80 uppercase tracking-wider font-bold">
          Leaderboard - {year}
        </p>
      </div>

      {loading && <div className="text-center py-10 font-bold text-yellow-400">Loading results...</div>}
      {!loading && error && <div className="text-center py-4 text-red-400 font-bold">{error}</div>}
      {!loading && !error && totalPlayers === 0 && notStartedPlayers.length === 0 && fieldPlayers.length === 0 && (
        <div className="text-center py-8 text-yellow-100 font-bold">No results to display for this tournament.</div>
      )}

      {!loading && fieldPlayers.length > 0 && (
        <div>
          <p className="text-center text-sm text-yellow-200/70 mb-4 italic">Results not yet available — displaying tournament field</p>
          <div className="card w-full shadow-inner overflow-hidden border border-gray-300 relative p-0 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full text-sm text-left text-gray-800">
                <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-semibold border-b border-gray-300">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-center w-12 sm:w-16">OWGR</th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-left">Player</th>
                    <th className="px-1 sm:px-2 py-3 sm:py-4 text-center w-16 sm:w-24">R1</th>
                    <th className="px-1 sm:px-2 py-3 sm:py-4 text-center w-16 sm:w-24">R2</th>
                    <th className="px-1 sm:px-2 py-3 sm:py-4 text-center w-16 sm:w-24">R3</th>
                    <th className="px-1 sm:px-2 py-3 sm:py-4 text-center w-16 sm:w-24">R4</th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-left">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fieldPlayers.map(player => (
                    <tr
                      key={player.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onGolferClick?.({ id: player.id, name: player.name, roundTeeTimes: player.roundTeeTimes })}
                    >
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-900 border-r border-gray-100 text-xs sm:text-sm">
                        {player.rank === 999 ? '—' : player.rank}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 font-bold text-green-800 border-r border-gray-100 text-xs sm:text-sm">{player.name}</td>
                      {(['r1', 'r2', 'r3', 'r4'] as const).map(r => (
                        <td key={r} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-gray-100 text-xs sm:text-sm text-gray-500">
                          {player.roundTeeTimes[r] || '—'}
                        </td>
                      ))}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600 text-xs sm:text-sm">{player.country || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(totalPlayers > 0 || notStartedPlayers.length > 0) && (
        <div className="card w-full shadow-inner overflow-hidden border border-gray-300 relative p-0 overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full text-sm text-left text-gray-800">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-semibold border-b border-gray-300">
                <tr>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-center w-12 sm:w-16">Pos</th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left">Player</th>
                  {rounds.map(r => (
                    <th key={r} className="px-1 sm:px-2 py-3 sm:py-4 text-center w-10 sm:w-16">R{r}</th>
                  ))}
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-center w-16 sm:w-20">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Players who made the cut */}
                {madeTheCut.map((player) => (
                  <tr
                    key={player.name}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onGolferClick?.({ id: player.id, name: player.name, roundTeeTimes: player.roundTeeTimes })}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 border-r border-gray-100 text-center text-xs sm:text-sm">{player.rank}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-bold text-green-800 hover:text-green-600 border-r border-gray-100 text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">{player.name}</td>
                    {rounds.map(r => (
                      <td key={r} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-gray-100 font-medium text-gray-700 text-xs sm:text-sm">
                        {player.rounds[r] !== undefined
                          ? fmtScore(player.rounds[r])
                          : player.roundTeeTimes?.[`r${r}`]
                            ? <span className="text-[10px] text-gray-400">{player.roundTeeTimes[`r${r}`]}</span>
                            : '-'}
                      </td>
                    ))}
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-bold text-gray-900 bg-gray-50/50 text-xs sm:text-sm">{fmtScore(player.totalStrokes)}</td>
                  </tr>
                ))}

                {/* Cut line separator */}
                {missedTheCut.length > 0 && (
                  <tr className="bg-red-50 border-y-2 border-red-200">
                    <td colSpan={rounds.length + 3} className="py-2 px-4 text-center font-bold text-red-600 text-xs uppercase tracking-widest">
                      — Projected Cut —
                    </td>
                  </tr>
                )}

                {/* Players who missed the cut */}
                {missedTheCut.map((player) => (
                  <tr
                    key={player.name}
                    className="bg-gray-50/80 hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors"
                    onClick={() => onGolferClick?.({ id: player.id, name: player.name, roundTeeTimes: player.roundTeeTimes })}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-red-500 border-r border-gray-200/60 text-center text-xs sm:text-sm">{player.rank}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-600 hover:text-gray-900 border-r border-gray-200/60 text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">{player.name}</td>
                    {rounds.map(r => (
                      <td key={r} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-gray-200/60 text-xs sm:text-sm">
                        {player.rounds[r] !== undefined
                          ? fmtScore(player.rounds[r])
                          : player.roundTeeTimes?.[`r${r}`]
                            ? <span className="text-[10px] text-gray-400">{player.roundTeeTimes[`r${r}`]}</span>
                            : '-'}
                      </td>
                    ))}
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-bold text-gray-600 text-xs sm:text-sm">{fmtScore(player.totalStrokes)}</td>
                  </tr>
                ))}

                {/* WD/DQ separator */}
                {withdrawnPlayers.length > 0 && (
                  <tr className="bg-amber-50 border-y-2 border-amber-200">
                    <td colSpan={rounds.length + 3} className="py-2 px-4 text-center font-bold text-amber-700 text-xs uppercase tracking-widest">
                      — Withdrawn / Disqualified —
                    </td>
                  </tr>
                )}

                {/* WD/DQ players */}
                {withdrawnPlayers.map((player) => (
                  <tr
                    key={player.name}
                    className="bg-amber-50/40 hover:bg-amber-50 text-gray-400 cursor-pointer transition-colors"
                    onClick={() => onGolferClick?.({ id: player.id, name: player.name, roundTeeTimes: player.roundTeeTimes })}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-bold text-amber-600 border-r border-gray-200/60 text-center text-xs sm:text-sm">{player.rank}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-gray-500 hover:text-gray-900 border-r border-gray-200/60 text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">{player.name}</td>
                    {rounds.map(r => (
                      <td key={r} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-gray-200/60 text-xs sm:text-sm text-gray-400">
                        {player.rounds[r] !== undefined
                          ? fmtScore(player.rounds[r])
                          : player.roundTeeTimes?.[`r${r}`]
                            ? <span className="text-[10px] text-gray-400">{player.roundTeeTimes[`r${r}`]}</span>
                            : '-'}
                      </td>
                    ))}
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-bold text-gray-400 text-xs sm:text-sm">
                      {Object.values(player.rounds).some(v => typeof v === 'number') ? fmtScore(player.totalStrokes) : '-'}
                    </td>
                  </tr>
                ))}

                {/* Not yet started — show tee times */}
                {notStartedPlayers.length > 0 && (
                  <tr className="bg-blue-50 border-y-2 border-blue-200">
                    <td colSpan={rounds.length + 3} className="py-2 px-4 text-center font-bold text-blue-700 text-xs uppercase tracking-widest">
                      — Tee Times —
                    </td>
                  </tr>
                )}
                {notStartedPlayers.map((player) => (
                  <tr
                    key={player.name}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onGolferClick?.({ id: player.id, name: player.name, roundTeeTimes: player.roundTeeTimes })}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-400 border-r border-gray-100 text-xs sm:text-sm">—</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-bold text-green-800 border-r border-gray-100 text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] sm:max-w-none">{player.name}</td>
                    {rounds.map(r => (
                      <td key={r} className="px-1 sm:px-2 py-2 sm:py-3 text-center border-r border-gray-100 text-xs sm:text-sm text-gray-500">
                        {player.roundTeeTimes?.[`r${r}`]
                          ? <span className="text-[10px] text-gray-400">{player.roundTeeTimes[`r${r}`]}</span>
                          : '-'}
                      </td>
                    ))}
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-400 text-xs sm:text-sm">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MastersResults;
