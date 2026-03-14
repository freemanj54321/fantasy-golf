import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../config/firebaseCollections';
import {
    SeasonRecord,
    TeamSeasonRecord,
    PlayerSeasonRecord,
    RoundScores,
    Team,
} from '../types';
import {
    isPlayerCut,
    isTeamCut,
    calculateTeamRoundScores,
    calculateTeamScore,
    getDailyWinners,
} from '../utils/leaderboardScoring';

const SEASON_RECORDS_COLLECTION = COLLECTIONS.SEASON_RECORDS;

// ─── Read ────────────────────────────────────────────────────────────────────

export const fetchSeasonRecord = async (year: number): Promise<SeasonRecord | null> => {
    const snap = await getDoc(doc(db, SEASON_RECORDS_COLLECTION, year.toString()));
    if (!snap.exists()) return null;
    return snap.data() as SeasonRecord;
};

export const fetchAllSeasonRecords = async (): Promise<SeasonRecord[]> => {
    const snap = await getDocs(collection(db, SEASON_RECORDS_COLLECTION));
    return snap.docs
        .map(d => d.data() as SeasonRecord)
        .sort((a, b) => b.year - a.year);
};

// ─── Write ───────────────────────────────────────────────────────────────────

export const saveSeasonRecord = async (record: SeasonRecord): Promise<void> => {
    const now = new Date().toISOString();
    await setDoc(doc(db, SEASON_RECORDS_COLLECTION, record.year.toString()), {
        ...record,
        updatedAt: now,
        createdAt: record.createdAt || now,
    });
};

// ─── Compute from FantasyGolf-Results ───────────────────────────────────────────

interface RawPlayerResult {
    playerId: string;
    firstName: string;
    lastName: string;
    teamId: string;
    teamName: string;
    roundId: number;
    totalToPar: string | number | null;
    roundScore: string | number | null;
    position: string | number | null;
    status?: string | null;
    draftOrder?: number;
    tournId?: string;
}

function toParNumber(val: string | number | null | undefined): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const s = String(val).toUpperCase();
    if (s === 'E' || s === 'EVEN') return 0;
    if (s === 'WD' || s === 'DQ' || s === 'CUT' || s === 'MDF') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function isWdOrDq(val: string | number | null | undefined): boolean {
    if (!val) return false;
    const s = String(val).toUpperCase();
    return s === 'WD' || s === 'DQ';
}

function isCutWdOrDq(val: string | number | null | undefined): boolean {
    if (!val) return false;
    const s = String(val).toUpperCase();
    return s === 'WD' || s === 'DQ' || s === 'CUT' || s === 'MDF';
}

function isPlayerWdOrDq(p: RawPlayerResult): boolean {
    return isWdOrDq(p.position) || isWdOrDq(p.totalToPar) || isWdOrDq(p.status);
}

/** Mirrors GameLeaderboard.isPlayerCut — excludes CUT, WD, DQ players from scoring */
function isPlayerExcludedFromScoring(p: RawPlayerResult): boolean {
    return isCutWdOrDq(p.position) || isCutWdOrDq(p.totalToPar) || isCutWdOrDq(p.status);
}

/**
 * Reads all FantasyGolf-Results documents for the given year and derives:
 * - Per-team, per-round scores (daily scores)
 * - Daily wins (team with the lowest combined score each round)
 * - Final standings (sum of each player's final cumulative totalToPar)
 * - Cuts made (player appeared in R3+ data and is not WD/DQ)
 *
 * Does NOT save — returns the computed record for preview/confirmation.
 */
export const computeSeasonRecord = async (
    year: number,
    tournamentId: string,
    tournamentName: string
): Promise<SeasonRecord> => {
    // 1. Fetch all player-round results for this year
    const resultsSnap = await getDocs(
        query(
            collection(db, 'FantasyGolf-Results'),
            where('year', '==', year)
        )
    );

    const allResults: RawPlayerResult[] = resultsSnap.docs.map(d => ({
        ...d.data(),
    })) as RawPlayerResult[];

    if (allResults.length === 0) {
        throw new Error(`No FantasyGolf-Results found for year ${year}.`);
    }

    // 2. Collect unique teams and unique rounds
    const teamMap = new Map<string, { teamId: string; teamName: string; draftOrder: number }>();
    const roundSet = new Set<number>();

    allResults.forEach(r => {
        if (!teamMap.has(r.teamId)) {
            teamMap.set(r.teamId, {
                teamId: r.teamId,
                teamName: r.teamName,
                draftOrder: r.draftOrder ?? 0,
            });
        }
        roundSet.add(r.roundId);
    });

    const rounds = Array.from(roundSet).sort((a, b) => a - b);

    // 3. Per-team × per-round: sum roundScore (score relative to par for that round)
    //    Structure: teamDailyScores[teamId][roundId] = summed score
    const teamDailyScores = new Map<string, Map<number, number | null>>();

    for (const { teamId } of teamMap.values()) {
        const roundScoreMap = new Map<number, number | null>();
        for (const r of rounds) {
            const roundPlayers = allResults.filter(
                p => p.teamId === teamId && p.roundId === r && !isPlayerExcludedFromScoring(p)
            );
            // Take the 2 lowest player scores for the round (matches GameLeaderboard logic)
            const scores = roundPlayers
                .map(p => toParNumber(p.roundScore))
                .filter((s): s is number => s !== null)
                .sort((a, b) => a - b);
            roundScoreMap.set(r, scores.length >= 2 ? scores[0] + scores[1] : null);
        }
        teamDailyScores.set(teamId, roundScoreMap);
    }

    // 4. Determine daily winners per round (lowest combined team score that round)
    const dailyWinsByTeam = new Map<string, number[]>(); // teamId → rounds won
    for (const { teamId } of teamMap.values()) {
        dailyWinsByTeam.set(teamId, []);
    }

    for (const r of rounds) {
        let bestScore: number | null = null;
        let bestTeamId: string | null = null;

        for (const { teamId } of teamMap.values()) {
            const score = teamDailyScores.get(teamId)?.get(r) ?? null;
            if (score !== null && (bestScore === null || score < bestScore)) {
                bestScore = score;
                bestTeamId = teamId;
            }
        }

        if (bestTeamId) {
            dailyWinsByTeam.get(bestTeamId)!.push(r);
        }
    }

    // 5. Final player records — use each player's totalToPar from their highest roundId
    //    Build: playersPerTeam[teamId] → array of player final records
    const playerFinalByTeam = new Map<string, Map<string, { result: RawPlayerResult; highestRound: number }>>();
    for (const { teamId } of teamMap.values()) {
        playerFinalByTeam.set(teamId, new Map());
    }

    for (const r of allResults) {
        const teamPlayers = playerFinalByTeam.get(r.teamId);
        if (!teamPlayers) continue;
        const existing = teamPlayers.get(r.playerId);
        if (!existing || r.roundId > existing.highestRound) {
            teamPlayers.set(r.playerId, { result: r, highestRound: r.roundId });
        }
    }

    // 6. All rounds scores per player (for display in PlayerSeasonRecord)
    //    Build: playerRoundScores[playerId][roundId] = roundScore
    const playerRoundScores = new Map<string, Map<number, number | null>>();
    for (const r of allResults) {
        if (!playerRoundScores.has(r.playerId)) {
            playerRoundScores.set(r.playerId, new Map());
        }
        const v = toParNumber(r.roundScore);
        playerRoundScores.get(r.playerId)!.set(r.roundId, v);
    }

    // 7. Build TeamSeasonRecord array
    const teamRecords: TeamSeasonRecord[] = [];

    for (const { teamId, teamName, draftOrder } of teamMap.values()) {
        const teamPlayers = playerFinalByTeam.get(teamId)!;
        const roundScoreMap = teamDailyScores.get(teamId)!;
        const winsRounds = dailyWinsByTeam.get(teamId)!;

        // Team total score = sum of per-round team scores (2-lowest per round)
        // This matches the GameLeaderboard scoring logic exactly.
        const validRoundScores = rounds
            .map(r => roundScoreMap.get(r) ?? null)
            .filter((s): s is number => s !== null);
        const teamTotal: number | null = validRoundScores.length > 0
            ? validRoundScores.reduce((sum, s) => sum + s, 0)
            : null;

        const playerRecords: PlayerSeasonRecord[] = [];
        let playerCutCount = 0; // individual players who survived the tournament cut

        for (const { result: p, highestRound } of teamPlayers.values()) {
            const wd = isPlayerWdOrDq(p);
            // status: 'cut' (or position/totalToPar === 'CUT') is the primary signal.
            // A player made the cut only if they are not excluded from scoring AND
            // they appeared in R3+ data.
            const madeCut = !isPlayerExcludedFromScoring(p) && highestRound >= 3;
            if (madeCut) playerCutCount++;

            // Per-round scores
            const pRounds = playerRoundScores.get(p.playerId) ?? new Map();
            const roundScores: RoundScores = {
                r1: pRounds.get(1) ?? null,
                r2: pRounds.get(2) ?? null,
                r3: pRounds.get(3) ?? null,
                r4: pRounds.get(4) ?? null,
            };

            playerRecords.push({
                playerId: p.playerId,
                name: `${p.firstName} ${p.lastName}`.trim(),
                finalPosition: p.position,
                totalToPar: p.totalToPar,
                madeCut,
                isWithdrawn: wd,
                roundScores,
            });
        }

        const roundScores: RoundScores = {
            r1: roundScoreMap.get(1) ?? null,
            r2: roundScoreMap.get(2) ?? null,
            r3: roundScoreMap.get(3) ?? null,
            r4: roundScoreMap.get(4) ?? null,
        };

        // Team made the cut when ≥2 players survived the tournament cut.
        const teamMadeCut = playerCutCount >= 2;
        // cutsEarned is a team-level stat: 1 if the team made the cut, 0 otherwise.
        const cutsEarned = teamMadeCut ? 1 : 0;

        teamRecords.push({
            teamId,
            teamName,
            finalPosition: 0, // calculated after sorting
            totalScore: teamTotal,
            roundScores,
            dailyWins: winsRounds.length,
            dailyWinRounds: winsRounds,
            overallWin: false, // set after sorting
            cutsEarned,
            teamMadeCut,
            draftOrder,
            players: playerRecords,
        });
    }

    // 8. Sort: teams that made the cut first (by totalScore asc), cut teams after.
    //    Mirrors GameLeaderboard.isTeamCut / sort logic exactly.
    teamRecords.sort((a, b) => {
        if (a.teamMadeCut && !b.teamMadeCut) return -1;
        if (!a.teamMadeCut && b.teamMadeCut) return 1;
        if (a.totalScore === null && b.totalScore === null) return 0;
        if (a.totalScore === null) return 1;
        if (b.totalScore === null) return -1;
        return a.totalScore - b.totalScore;
    });

    teamRecords.forEach((t, i) => {
        t.finalPosition = i + 1;
        t.overallWin = i === 0 && (t.teamMadeCut ?? true); // Only the cut-surviving leader wins
    });

    // 9. Attempt to find the actual tournament winner from Tournament-Results
    let tournamentWinner = null;
    try {
        const trSnap = await getDocs(
            query(
                collection(db, COLLECTIONS.TOURNAMENT_RESULTS),
                where('tournId', '==', tournamentId),
                where('year', '==', year),
                orderBy('roundId', 'desc')
            )
        );
        if (!trSnap.empty) {
            const latestDoc = trSnap.docs[0].data();
            const leaderboard: any[] = latestDoc.leaderboard || latestDoc.players || [];
            const winner = leaderboard.find((p: any) => {
                const pos = String(p.position ?? '').trim();
                return pos === '1';
            });
            if (winner) {
                tournamentWinner = {
                    name: `${winner.firstName ?? ''} ${winner.lastName ?? ''}`.trim() || winner.name || '',
                    playerId: winner.playerId,
                    totalToPar: winner.totalToPar ?? winner.total ?? null,
                    country: winner.country,
                };
            }
        }
    } catch {
        // Tournament winner lookup is best-effort; admin can fill it in manually
    }

    const now = new Date().toISOString();
    return {
        year,
        tournamentId,
        tournamentName,
        tournamentWinner,
        teams: teamRecords,
        createdAt: now,
        updatedAt: now,
    };
};

// ─── Build from Leaderboard Teams ────────────────────────────────────────────

/**
 * Converts Team[] data already displayed on the leaderboard into a SeasonRecord.
 * Uses the exact same scoring utilities as GameLeaderboard — no separate calculation,
 * no re-fetch from FantasyGolf-Results. What you see on the leaderboard is what gets saved.
 */
export const buildSeasonRecordFromTeams = async (
    teams: Team[],
    year: number,
    tournamentId: string,
    tournamentName: string,
): Promise<SeasonRecord> => {
    if (!teams || teams.length === 0) {
        throw new Error('No teams provided.');
    }

    // Compute daily winners across all teams (same as GameLeaderboard.getDailyWinners)
    const winners = getDailyWinners(teams);

    const teamRecords: TeamSeasonRecord[] = teams.map(team => {
        const teamCut = isTeamCut(team);
        const roundScores = calculateTeamRoundScores(team);
        const totalScore = calculateTeamScore(team);

        // Award daily win to every team that ties for the lowest score (matches leaderboard highlighting)
        const dailyWinRounds: number[] = [];
        if (roundScores.r1 !== null && roundScores.r1 === winners.r1) dailyWinRounds.push(1);
        if (roundScores.r2 !== null && roundScores.r2 === winners.r2) dailyWinRounds.push(2);
        if (roundScores.r3 !== null && roundScores.r3 === winners.r3) dailyWinRounds.push(3);
        if (roundScores.r4 !== null && roundScores.r4 === winners.r4) dailyWinRounds.push(4);

        const players: PlayerSeasonRecord[] = (team.roster || []).map(golfer => {
            const playerCut = isPlayerCut(golfer);
            const posStr = typeof golfer.position === 'string' ? golfer.position.toUpperCase() : '';
            const statusStr = typeof golfer.status === 'string' ? golfer.status.toUpperCase() : '';
            const isWithdrawn = posStr === 'WD' || statusStr === 'WD';
            return {
                playerId: golfer.id,
                name: golfer.name,
                finalPosition: golfer.position ?? null,
                totalToPar: golfer.topar ?? null,
                madeCut: !playerCut,
                isWithdrawn,
                roundScores: golfer.roundScores ?? {},
            };
        });

        return {
            teamId: team.teamId || team.id,
            teamName: team.name,
            finalPosition: 0,       // set after sort
            totalScore,
            roundScores,
            dailyWins: dailyWinRounds.length,
            dailyWinRounds,
            overallWin: false,      // set after sort
            cutsEarned: teamCut ? 0 : 1,
            teamMadeCut: !teamCut,
            draftOrder: team.draftOrder ?? 0,
            players,
        };
    });

    // Sort: surviving teams by score asc, cut teams after — mirrors GameLeaderboard sort
    teamRecords.sort((a, b) => {
        if (a.teamMadeCut && !b.teamMadeCut) return -1;
        if (!a.teamMadeCut && b.teamMadeCut) return 1;
        if (a.totalScore === null && b.totalScore === null) return 0;
        if (a.totalScore === null) return 1;
        if (b.totalScore === null) return -1;
        return a.totalScore - b.totalScore;
    });

    teamRecords.forEach((t, i) => {
        t.finalPosition = i + 1;
        t.overallWin = i === 0 && t.teamMadeCut === true;
    });

    // Try to get the actual PGA tournament winner (best effort — admin can fill in manually)
    let tournamentWinner = null;
    try {
        const trSnap = await getDocs(
            query(
                collection(db, COLLECTIONS.TOURNAMENT_RESULTS),
                where('tournId', '==', tournamentId),
                where('year', '==', year),
                orderBy('roundId', 'desc')
            )
        );
        if (!trSnap.empty) {
            const latestDoc = trSnap.docs[0].data();
            const leaderboard: any[] = latestDoc.leaderboard || latestDoc.players || [];
            const winner = leaderboard.find((p: any) => {
                const pos = String(p.position ?? '').trim();
                return pos === '1';
            });
            if (winner) {
                tournamentWinner = {
                    name: `${winner.firstName ?? ''} ${winner.lastName ?? ''}`.trim() || winner.name || '',
                    playerId: winner.playerId,
                    totalToPar: winner.totalToPar ?? winner.total ?? null,
                    country: winner.country,
                };
            }
        }
    } catch {
        // Best-effort
    }

    const now = new Date().toISOString();
    return {
        year,
        tournamentId,
        tournamentName,
        tournamentWinner,
        teams: teamRecords,
        createdAt: now,
        updatedAt: now,
    };
};
