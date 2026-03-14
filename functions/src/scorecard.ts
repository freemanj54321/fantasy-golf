import { getFirestore } from 'firebase-admin/firestore';
import { getHeaders, GOLF_API_HOST, DEFAULT_ORG_ID, axios } from './lib/apiClient';

export interface HoleScore {
    holeId: number;
    holeScore: number;
    par: number;
}

export interface ScorecardRound {
    orgId: string;
    year: number;
    tournId: string;
    courseId: string;
    playerId: string;
    lastName: string;
    firstName: string;
    roundId: number;
    startingHole: number;
    roundComplete: boolean;
    lastUpdated: unknown;
    currentRoundScore: string;
    currentHole: number;
    holes: Record<string, HoleScore>;
    totalShots: number;
    timestamp: unknown;
}

// Function to fetch scorecard for a specific player
export const fetchPlayerScorecard = async (tournId: string, year: string, playerId: string): Promise<ScorecardRound[]> => {
    const url = `https://${GOLF_API_HOST}/scorecard?orgId=${DEFAULT_ORG_ID}&tournId=${tournId}&year=${year}&playerId=${playerId}`;

    try {
        const response = await axios.get(url, { headers: getHeaders() });
        const data = response.data;

        // Normalize to array — API may return a bare array or wrap it in an object
        if (Array.isArray(data)) return data;
        if (data?.rounds && Array.isArray(data.rounds)) return data.rounds;
        if (data?.scorecards && Array.isArray(data.scorecards)) return data.scorecards;

        // Unexpected shape — log and return empty so we don't silently skip
        console.warn(`Unexpected scorecard response shape for player ${playerId}:`, JSON.stringify(data).slice(0, 300));
        return [];
    } catch (error) {
        console.error(`Error fetching scorecard for player ${playerId}:`, error);
        throw error;
    }
};

export const updatePlayerScorecardInFirestore = async (
    tournId: string,
    year: number,
    roundId: number,
    playerId: string,
    scorecardData: ScorecardRound[]
): Promise<void> => {
    const db = getFirestore();

    // Find the current round scorecard — use Number() to handle string/MongoDB int formats
    const currentRoundCards = scorecardData.filter(s => {
        const apiRoundId = typeof s.roundId === 'object'
            ? parseInt((s.roundId as any).$numberInt, 10)
            : Number(s.roundId);
        return apiRoundId === roundId;
    });
    if (currentRoundCards.length === 0) {
        console.log(`Player ${playerId}: no scorecard data for round ${roundId}. API returned ${scorecardData.length} round(s): [${scorecardData.map((s: any) => {
            const rid = typeof s.roundId === 'object' ? (s.roundId as any).$numberInt : s.roundId;
            return rid;
        }).join(', ')}]`);
        return;
    }

    // The API might return an array of rounds or just the specified round, we'll take the first matching
    const roundCard = currentRoundCards[0];

    // Calculate `thru`. If round complete, it's 'F' or 18. Otherwise use currentHole
    let thru: number | string = roundCard.currentHole;
    if (roundCard.roundComplete || roundCard.currentHole >= 18) {
        thru = 'F';
    } else if (roundCard.currentHole === 0 && roundCard.totalShots > 0) {
        thru = 18; // Some Edge cases
    }

    // Update Scorecard-Sync with live score data for this player/round
    const syncDocId = `${year}-${tournId}-${playerId}-${roundId}`;
    await db.collection('Scorecard-Sync').doc(syncDocId).set({
        roundScore: roundCard.currentRoundScore,
        strokes: roundCard.totalShots,
        thru,
        playerId,
        tournId,
        year,
        roundId,
        lastScorecardSync: new Date(),
        lastUpdated: new Date()
    }, { merge: true });

    // Upsert Tournament-Results with scorecard score data. position, status, isAmateur,
    // totalToPar, cumulativeStrokes, and teeTime come from the leaderboard API
    // (autosyncTournamentResults) — merge: true preserves those fields when already set.
    const tournResultsDocId = `${tournId}-${year}-R${roundId}-${playerId}`;
    await db.collection('Tournament-Results').doc(tournResultsDocId).set({
        playerId,
        tournId,
        year,
        roundId,
        firstName: roundCard.firstName || '',
        lastName: roundCard.lastName || '',
        roundScore: roundCard.currentRoundScore,
        strokes: roundCard.totalShots,
        thru,
        lastScorecardSync: new Date(),
        lastUpdated: new Date(),
    }, { merge: true });

    console.log(`Updated scorecard for player ${playerId} (Thru: ${thru}, Score: ${roundCard.currentRoundScore})`);

    // Also keep Player-Scorecards up to date (used by the hole-by-hole scorecard viewer)
    const scorecardDocId = `${year}-${tournId}-${playerId}-${roundId}`;
    await db.collection('Player-Scorecards').doc(scorecardDocId).set({
        ...roundCard,
        year,          // ensure numeric year matches Scorecard-Sync
        lastUpdated: new Date()
    }, { merge: true });
};
