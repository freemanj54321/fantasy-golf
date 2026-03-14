import { getFirestore } from 'firebase-admin/firestore';

/**
 * Syncs scores from Tournament-Results over to FantasyGolf-Results for players that exist on a drafted team.
 */
export const saveFantasyGolfResultsInFirestore = async (tournId: string, year: number | string, roundId: number | string): Promise<number> => {
    const db = getFirestore();
    const numericYear = typeof year === 'string' ? parseInt(year, 10) : year;
    const numericRoundId = typeof roundId === 'string' ? parseInt(roundId, 10) : roundId;

    console.log(`Backend sync: Saving FantasyGolf Results for tournId ${tournId}, year ${numericYear}, round ${numericRoundId}`);

    // 1. Fetch all teams
    const teamsRef = db.collection("FantasyGolf-Teams");
    const teamsSnapshot = await teamsRef.where("year", "==", numericYear).get();

    if (teamsSnapshot.empty) {
        console.log(`No FantasyGolf-Teams found for year ${numericYear}. Skipping FantasyGolf-Results sync.`);
        return 0;
    }

    const playerToTeamMap = new Map<string, any>();
    teamsSnapshot.docs.forEach(teamDoc => {
        const teamData = teamDoc.data();
        const roster = teamData.roster || teamData.players || [];
        const teamInfo = {
            teamId: teamData.teamId || teamDoc.id,
            teamName: teamData.name || 'Unknown Team',
            ownerId: teamData.ownerId || '',
            ownerName: teamData.ownerEmail || '',
        };

        for (const golfer of roster) {
            const playerId = String(golfer.id || golfer.playerId);
            playerToTeamMap.set(playerId, teamInfo);
        }
    });

    // 2. Fetch tournament results (leaderboard data: position, name, totalToPar, etc.)
    const resultsRef = db.collection("Tournament-Results");

    // Check both string and integer year to be safe against data inconsistencies
    let resultsSnapshot = await resultsRef
        .where("tournId", "==", tournId)
        .where("year", "==", String(numericYear))
        .where("roundId", "==", numericRoundId)
        .get();

    if (resultsSnapshot.empty) {
        resultsSnapshot = await resultsRef
            .where("tournId", "==", tournId)
            .where("year", "==", numericYear)
            .where("roundId", "==", numericRoundId)
            .get();
    }

    if (resultsSnapshot.empty) {
        console.log(`No tournament results found for round ${numericRoundId}. Skipping FantasyGolf-Results sync.`);
        return 0;
    }

    // 3. Fetch live score data from Scorecard-Sync (roundScore, strokes, thru written by scorecard API)
    const syncSnapshot = await db.collection("Scorecard-Sync")
        .where("tournId", "==", tournId)
        .where("year", "==", numericYear)
        .where("roundId", "==", numericRoundId)
        .get();

    const scorecardSyncMap = new Map<string, { roundScore: any; strokes: any; thru: any }>();
    for (const syncDoc of syncSnapshot.docs) {
        const s = syncDoc.data();
        if (s.playerId) {
            scorecardSyncMap.set(String(s.playerId), {
                roundScore: s.roundScore ?? null,
                strokes: s.strokes ?? null,
                thru: s.thru ?? null,
            });
        }
    }

    // 4. Save FantasyGolf-Results
    let savedCount = 0;
    const mezztersResultsRef = db.collection("FantasyGolf-Results");

    // Batch in chunks of 500
    const chunks = [];
    const docs = resultsSnapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        const batch = db.batch();

        for (const docSnap of chunk) {
            const data = docSnap.data();
            const playerId = String(data.playerId);
            const teamInfo = playerToTeamMap.get(playerId);

            if (!teamInfo) continue;

            const syncData = scorecardSyncMap.get(playerId);
            const docId = `${tournId}-${numericYear}-R${numericRoundId}-${playerId}`;
            const docRef = mezztersResultsRef.doc(docId);

            batch.set(docRef, {
                tournId: tournId,
                year: numericYear,
                roundId: numericRoundId,
                playerId: playerId,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                position: data.position ?? null,
                status: data.status ?? null,
                isAmateur: data.isAmateur ?? false,
                roundScore: syncData?.roundScore ?? data.roundScore ?? null,
                total: data.cumulativeStrokes ?? null,
                totalToPar: data.totalToPar ?? null,
                strokes: data.strokes ?? null,
                thru: syncData?.thru ?? data.thru ?? null,
                teeTime: data.teeTime ?? null,
                teamId: teamInfo.teamId,
                teamName: teamInfo.teamName,
                ownerId: teamInfo.ownerId,
                ownerName: teamInfo.ownerName,
                lastUpdated: new Date()
            }, { merge: true });

            savedCount++;
        }
        await batch.commit();
    }

    console.log(`Successfully synced ${savedCount} players to FantasyGolf-Results.`);
    return savedCount;
};
