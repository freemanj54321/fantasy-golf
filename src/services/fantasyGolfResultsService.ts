import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { SyncResult } from './apiClient';
import { Logger } from '../lib/logger';

const logger = new Logger('FantasyGolfResults');

// Local interface (matches types.ts FantasyGolfPlayerResult for legacy snapshot)
interface FantasyGolfPlayerResultLocal {
    playerId: string;
    name: string;
    rank: number;
    position: string | number | null;
    totalToPar: string | number | null;
    thru: string | number | null;
    roundScores: {
        r1?: string | number | null;
        r2?: string | number | null;
        r3?: string | number | null;
        r4?: string | number | null;
    };
    isCut: boolean;
}

interface FantasyGolfTeamResultLocal {
    teamId: string;
    teamName: string;
    ownerEmail: string;
    ownerId: string;
    ownerName: string;
    teamScore: number | null;
    teamPosition: number | null;
    isCut: boolean;
    players: FantasyGolfPlayerResultLocal[];
}

// Silence unused variable warnings — these types document the shape of data
// written to Firestore but are not directly instantiated here.
type _Unused = FantasyGolfPlayerResultLocal | FantasyGolfTeamResultLocal;

/**
 * Checks if FantasyGolf-Results needs to be synced from Tournament-Results for a given tournament, year, and round.
 * Returns true if Tournament-Results has newer records than FantasyGolf-Results or if there are records in Tournament-Results that don't exist in FantasyGolf-Results.
 */
export const checkIfFantasyGolfResultsNeedsSync = async (
    tournId: string,
    year: number,
    roundId: number
): Promise<boolean> => {
    try {
        if (!tournId || !year || !roundId) return false;

        // Helper to merge numeric and string year/roundId variants to handle legacy data
        const fetchMergedDocs = async (collectionName: string) => {
            const ref = collection(db, collectionName);
            const queries = [
                query(
                    ref,
                    where("tournId", "==", tournId),
                    where("year", "==", year),
                    where("roundId", "==", roundId)
                ),
                query(
                    ref,
                    where("tournId", "==", tournId),
                    where("year", "==", String(year)),
                    where("roundId", "==", String(roundId))
                )
            ];

            const merged: any[] = [];
            const seenIds = new Set<string>();

            for (const q of queries) {
                const snap = await getDocs(q);
                snap.forEach(docSnap => {
                    if (!seenIds.has(docSnap.id)) {
                        seenIds.add(docSnap.id);
                        merged.push(docSnap);
                    }
                });
            }

            return merged;
        };

        const tournamentDocs = await fetchMergedDocs("Tournament-Results");

        if (tournamentDocs.length === 0) {
            logger.info('No Tournament-Results found for sync scope. Skipping FantasyGolf-Results sync.');
            return false; // Nothing to sync
        }

        const mezztersDocs = await fetchMergedDocs("FantasyGolf-Results");

        if (mezztersDocs.length === 0) {
            logger.info('No FantasyGolf-Results exist yet for this tournament/year/round. Sync needed.');
            return true;
        }

        const resultsCount = tournamentDocs.length;
        const mezztersCount = mezztersDocs.length;

        // Find newest timestamp in Tournament-Results
        let maxTournamentUpdated = 0;
        tournamentDocs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.lastUpdated && typeof data.lastUpdated.toDate === 'function') {
                const time = data.lastUpdated.toDate().getTime();
                if (time > maxTournamentUpdated) maxTournamentUpdated = time;
            }
        });

        // Find newest timestamp in FantasyGolf-Results
        let maxMezztersUpdated = 0;
        mezztersDocs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.lastUpdated && typeof data.lastUpdated.toDate === 'function') {
                const time = data.lastUpdated.toDate().getTime();
                if (time > maxMezztersUpdated) maxMezztersUpdated = time;
            }
        });

        const hasNewerTournamentUpdates = maxTournamentUpdated > maxMezztersUpdated;
        const countsDiffer = resultsCount !== mezztersCount;

        if (countsDiffer || hasNewerTournamentUpdates) {
            logger.info(
                'Tournament-Results and FantasyGolf-Results are out of sync. Sync needed.',
                { resultsCount, mezztersCount, maxTournamentUpdated, maxMezztersUpdated }
            );
            return true;
        }

        logger.info('Tournament-Results and FantasyGolf-Results appear in sync. No sync needed.');
        return false;
    } catch (e) {
        logger.error("Error in checkIfFantasyGolfResultsNeedsSync:", e);
        return false;
    }
};

/**
 * Saves individual player round records to FantasyGolf-Results collection.
 * Each record contains: player info, tournament/round info, scores, and team info.
 * Called after syncing tournament results.
 */
export const saveFantasyGolfResults = async (
    tournId: string,
    year: number,
    roundId: number,
    tournamentName?: string
): Promise<SyncResult> => {
    try {
        logger.info(`Saving FantasyGolf Results for tournament ${tournId}, year ${year}, round ${roundId}...`);

        // 1. Fetch all teams for this year
        const teamsRef = collection(db, "FantasyGolf-Teams");
        const teamsQuery = query(teamsRef, where("year", "==", year));
        const teamsSnapshot = await getDocs(teamsQuery);

        if (teamsSnapshot.empty) {
            logger.warn(`No teams found for year ${year}. Skipping FantasyGolf-Results save.`);
            return { createdCount: 0, updatedCount: 0 };
        }

        // Build a map of playerId -> team info for quick lookup
        const playerToTeamMap = new Map<string, {
            teamId: string;
            teamName: string;
            ownerId: string;
            ownerName: string;
        }>();

        teamsSnapshot.docs.forEach(teamDoc => {
            const teamData = teamDoc.data();
            const roster = teamData.roster || teamData.players || [];
            const teamInfo = {
                teamId: teamData.teamId || teamDoc.id, // Use teamId if available, otherwise doc.id
                teamName: teamData.name || 'Unknown Team',
                ownerId: teamData.ownerId || '',
                ownerName: teamData.ownerEmail || '', // Use ownerEmail as fallback for ownerName
            };

            for (const golfer of roster) {
                const playerId = String(golfer.id || (golfer as any).playerId);
                playerToTeamMap.set(playerId, teamInfo);
            }
        });

        // 2. Fetch tournament results for this specific round, tolerant of numeric/string year & roundId
        const resultsRef = collection(db, "Tournament-Results");
        const resultsQueries = [
            query(
                resultsRef,
                where("tournId", "==", tournId),
                where("year", "==", year),
                where("roundId", "==", roundId)
            ),
            query(
                resultsRef,
                where("tournId", "==", tournId),
                where("year", "==", String(year)),
                where("roundId", "==", String(roundId))
            )
        ];

        const tournamentDocs: any[] = [];
        {
            const seenIds = new Set<string>();
            for (const q of resultsQueries) {
                const snap = await getDocs(q);
                snap.forEach(docSnap => {
                    if (!seenIds.has(docSnap.id)) {
                        seenIds.add(docSnap.id);
                        tournamentDocs.push(docSnap);
                    }
                });
            }
        }

        if (tournamentDocs.length === 0) {
            logger.warn(`No tournament results found for round ${roundId}. Skipping FantasyGolf-Results save.`);
            return { createdCount: 0, updatedCount: 0 };
        }

        // 3. Save individual player round records (batch in chunks of 450 to stay under Firestore's 500 limit)
        let batch = writeBatch(db);
        let operationCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        for (const docSnap of tournamentDocs) {
            const data = docSnap.data();
            const playerId = String(data.playerId);

            // Only save players who are on a FantasyGolf team
            const teamInfo = playerToTeamMap.get(playerId);

            if (!teamInfo) {
                logger.debug?.(`[Sync Trace] Skipping player ${data.firstName} ${data.lastName} (ID: ${playerId}) – not found on any FantasyGolf team.`);
                continue; // Skip players not on any team
            }

            const playerRoundRecord = {
                // Player info
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                playerId: playerId,
                isAmateur: data.isAmateur || false,

                // Tournament/round info
                tournId: tournId,
                tournamentName: tournamentName ?? null,
                year: year,
                roundId: roundId,

                // Score info
                position: data.position ?? null,
                status: data.status ?? null,
                strokes: data.strokes ?? null,
                roundScore: data.roundScore ?? null,
                total: data.cumulativeStrokes ?? null,
                totalToPar: data.totalToPar ?? null,
                thru: data.thru ?? null,
                teeTime: data.teeTime ?? null,

                // Team info
                teamId: teamInfo.teamId,
                teamName: teamInfo.teamName,
                ownerId: teamInfo.ownerId,
                ownerName: teamInfo.ownerName,

                // Metadata
                lastUpdated: new Date(),
            };

            console.log(`[Sync Trace] Preparing to save player ${data.firstName} ${data.lastName} (ID: ${playerId}) for team ${teamInfo.teamName} (Round ${roundId}). Round Score: ${playerRoundRecord.roundScore}, Strokes: ${playerRoundRecord.strokes}`);

            const docId = `${tournId}-${year}-R${roundId}-${playerId}`;
            batch.set(doc(db, "FantasyGolf-Results", docId), playerRoundRecord, { merge: true });
            createdCount++;

            operationCount++;
            if (operationCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            logger.info(`FantasyGolf-Results sync complete: ${createdCount} created, ${updatedCount} updated.`);
        }

        return { createdCount, updatedCount };

    } catch (error) {
        logger.error("Error saving FantasyGolf Results:", error);
        throw error;
    }
};
