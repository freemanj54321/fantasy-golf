import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    setDoc,
    arrayUnion,
    writeBatch,
    Unsubscribe,
    QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Golfer } from '../types';
import { COLLECTIONS } from '../config/firebaseCollections';

// Logger for team operations
class TeamServiceLogger {
    private prefix = '[TeamService]';

    info(message: string, ...args: unknown[]): void {
        console.log(`${this.prefix} ${message}`, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`${this.prefix} ${message}`, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`${this.prefix} ${message}`, ...args);
    }
}

const logger = new TeamServiceLogger();

// Helper to unwrap MongoDB-style number values
const unwrapValue = (val: any): any => {
    if (val && typeof val === 'object' && val.$numberInt) {
        return parseInt(val.$numberInt, 10);
    }
    return val;
};

// Helper to sanitize golfer data
const sanitizeGolfer = (golfer: any): Golfer => {
    if (!golfer) return golfer;
    return {
        ...golfer,
        rank: unwrapValue(golfer.rank),
        position: unwrapValue(golfer.position),
        topar: unwrapValue(golfer.topar),
        thru: unwrapValue(golfer.thru),
    };
};

/**
 * Subscribe to real-time team updates
 * @param year - Filter teams by year (optional)
 * @param onUpdate - Callback function called when teams change
 * @returns Unsubscribe function
 */
export const subscribeToTeams = (
    onUpdate: (teams: Team[]) => void,
    year?: number
): Unsubscribe => {
    try {
        logger.info(`Subscribing to teams${year ? ` for year ${year}` : ''}`);

        const collectionRef = collection(db, COLLECTIONS.MEZZTER_TEAMS);
        const constraints: QueryConstraint[] = [orderBy('name')];

        if (year) {
            constraints.unshift(where('year', '==', year));
        }

        const q = query(collectionRef, ...constraints);

        return onSnapshot(
            q,
            (snapshot) => {
                const teams = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const rawRoster = data.roster || data.players || [];
                    const roster = Array.isArray(rawRoster) ? rawRoster.map(sanitizeGolfer) : [];
                    return { id: doc.id, ...data, roster } as Team;
                });
                // Client-side sort: First by draftOrder (if available), then fallback to alphabetical by name
                teams.sort((a, b) => {
                    if (a.draftOrder !== undefined && b.draftOrder !== undefined) {
                        return a.draftOrder - b.draftOrder;
                    }
                    if (a.draftOrder !== undefined) return -1;
                    if (b.draftOrder !== undefined) return 1;
                    return a.name.localeCompare(b.name);
                });
                logger.info(`Received ${teams.length} teams from subscription`);
                onUpdate(teams);
            },
            (error) => {
                logger.error('Error in teams subscription:', error);
                onUpdate([]); // Return empty array on error
            }
        );
    } catch (error) {
        logger.error('Error setting up teams subscription:', error);
        throw new Error(`Failed to subscribe to teams: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Fetch all teams (or filtered by year)
 * @param year - Filter teams by year (optional)
 * @returns Array of teams
 */
export const fetchTeams = async (year?: number): Promise<Team[]> => {
    try {
        logger.info(`Fetching teams${year ? ` for year ${year}` : ''}`);

        const collectionRef = collection(db, COLLECTIONS.MEZZTER_TEAMS);
        const constraints: QueryConstraint[] = [orderBy('name')];

        if (year) {
            constraints.unshift(where('year', '==', year));
        }

        const q = query(collectionRef, ...constraints);
        const snapshot = await getDocs(q);

        const teams = snapshot.docs.map(doc => {
            const data = doc.data();
            const rawRoster = data.roster || data.players || [];
            const roster = Array.isArray(rawRoster) ? rawRoster.map(sanitizeGolfer) : [];
            return { id: doc.id, ...data, roster } as Team;
        });

        // Client-side sort
        teams.sort((a, b) => {
            if (a.draftOrder !== undefined && b.draftOrder !== undefined) {
                return a.draftOrder - b.draftOrder;
            }
            if (a.draftOrder !== undefined) return -1;
            if (b.draftOrder !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });

        logger.info(`Fetched ${teams.length} teams`);
        return teams;
    } catch (error) {
        logger.error('Error fetching teams:', error);
        throw new Error(`Failed to fetch teams: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Fetch a single team by ID
 * @param teamId - Team document ID
 * @returns Team or null if not found
 */
export const fetchTeamById = async (teamId: string): Promise<Team | null> => {
    try {
        logger.info(`Fetching team ${teamId}`);

        const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, teamId);
        const snapshot = await getDocs(query(collection(db, COLLECTIONS.MEZZTER_TEAMS), where('__name__', '==', teamId)));

        if (snapshot.empty) {
            logger.warn(`Team ${teamId} not found`);
            return null;
        }

        const data = snapshot.docs[0].data();
        const rawRoster = data.roster || data.players || [];
        const roster = Array.isArray(rawRoster) ? rawRoster.map(sanitizeGolfer) : [];

        return { id: snapshot.docs[0].id, ...data, roster } as Team;
    } catch (error) {
        logger.error(`Error fetching team ${teamId}:`, error);
        throw new Error(`Failed to fetch team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Generate a unique team ID
 * Format: team_<timestamp>_<random>
 */
const generateTeamId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `team_${timestamp}_${random}`;
};

/**
 * Fetch all unique teams across all years, deduplicated by teamId.
 * Returns one representative entry per unique teamId, sorted by name.
 */
export const fetchAllUniqueTeams = async (): Promise<Team[]> => {
    try {
        logger.info('Fetching all unique teams across all years');
        const snapshot = await getDocs(collection(db, COLLECTIONS.MEZZTER_TEAMS));
        const seen = new Set<string>();
        const teams: Team[] = [];
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const tid = data.teamId as string;
            if (tid && !seen.has(tid)) {
                seen.add(tid);
                teams.push({ id: docSnap.id, ...data, roster: [] } as Team);
            }
        });
        teams.sort((a, b) => a.name.localeCompare(b.name));
        logger.info(`Found ${teams.length} unique teams`);
        return teams;
    } catch (error) {
        logger.error('Error fetching unique teams:', error);
        throw new Error(`Failed to fetch unique teams: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Create a new team
 * @param team - Team data (without ID)
 * @returns New team document ID
 */
export const createTeam = async (team: Omit<Team, 'id'>): Promise<string> => {
    try {
        logger.info(`Creating team: ${team.name}`);

        if (!team.name || !team.year) {
            throw new Error('Team name and year are required');
        }

        // Generate unique teamId if not provided
        const teamId = team.teamId || generateTeamId();

        const teamData = {
            ...team,
            teamId,
            roster: team.roster || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, COLLECTIONS.MEZZTER_TEAMS), teamData);
        logger.info(`Team created with ID: ${docRef.id}, teamId: ${teamId}`);
        return docRef.id;
    } catch (error) {
        logger.error('Error creating team:', error);
        throw new Error(`Failed to create team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Update a team
 * @param teamId - Team document ID
 * @param updates - Partial team data to update
 */
export const updateTeam = async (teamId: string, updates: Partial<Omit<Team, 'id'>>): Promise<void> => {
    try {
        logger.info(`Updating team ${teamId}`);

        if (!teamId) {
            throw new Error('Team ID is required');
        }

        const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, teamId);
        await updateDoc(teamRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });

        logger.info(`Team ${teamId} updated successfully`);
    } catch (error) {
        logger.error(`Error updating team ${teamId}:`, error);
        throw new Error(`Failed to update team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Delete a team
 * @param teamId - Team document ID
 */
export const deleteTeam = async (teamId: string): Promise<void> => {
    try {
        logger.info(`Deleting team ${teamId}`);

        if (!teamId) {
            throw new Error('Team ID is required');
        }

        const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, teamId);
        await deleteDoc(teamRef);

        logger.info(`Team ${teamId} deleted successfully`);
    } catch (error) {
        logger.error(`Error deleting team ${teamId}:`, error);
        throw new Error(`Failed to delete team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Add a player to a team's roster
 * @param teamId - Team document ID
 * @param player - Golfer to add
 */
export const addPlayerToTeam = async (teamId: string, player: Golfer): Promise<void> => {
    try {
        logger.info(`Adding player ${player.name} to team ${teamId}`);

        if (!teamId || !player) {
            throw new Error('Team ID and player are required');
        }

        const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, teamId);
        await updateDoc(teamRef, {
            roster: arrayUnion(player),
            updatedAt: new Date().toISOString()
        });

        logger.info(`Player added to team ${teamId} successfully`);
    } catch (error) {
        logger.error(`Error adding player to team ${teamId}:`, error);
        throw new Error(`Failed to add player to team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Remove a player from a team's roster
 * @param teamId - Team document ID
 * @param player - Golfer to remove (must match exactly)
 */
export const removePlayerFromTeam = async (teamId: string, player: Golfer): Promise<void> => {
    try {
        logger.info(`Removing player ${player.name} from team ${teamId}`);

        if (!teamId || !player) {
            throw new Error('Team ID and player are required');
        }

        const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, teamId);
        const snapshot = await getDoc(teamRef);
        if (!snapshot.exists()) {
            throw new Error(`Team ${teamId} not found`);
        }
        const currentRoster = (snapshot.data().roster || []) as Array<{ id: string }>;
        const updatedRoster = currentRoster.filter(p => p.id !== player.id);
        await updateDoc(teamRef, {
            roster: updatedRoster,
            updatedAt: new Date().toISOString()
        });

        logger.info(`Player removed from team ${teamId} successfully`);
    } catch (error) {
        logger.error(`Error removing player from team ${teamId}:`, error);
        throw new Error(`Failed to remove player from team: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Reset draft by clearing all team rosters
 * @param year - Optional year to filter teams (resets all if not provided)
 */
export const resetDraft = async (year?: number): Promise<number> => {
    try {
        logger.info(`Resetting draft${year ? ` for year ${year}` : ''}`);

        const collectionRef = collection(db, COLLECTIONS.MEZZTER_TEAMS);
        const constraints: QueryConstraint[] = [];

        if (year) {
            constraints.push(where('year', '==', year));
        }

        const q = query(collectionRef, ...constraints);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            logger.warn('No teams found to reset');
            return 0;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                roster: [],
                updatedAt: new Date().toISOString()
            });
        });

        await batch.commit();

        // Also reset the FantasyGolf-Results database for that year
        try {
            const resultsRef = collection(db, "FantasyGolf-Results");
            const constraintsResults: QueryConstraint[] = [];
            if (year) {
                constraintsResults.push(where('year', '==', year));
            }
            const resultsQ = query(resultsRef, ...constraintsResults);
            const resultsSnap = await getDocs(resultsQ);

            if (!resultsSnap.empty) {
                const resultsBatch = writeBatch(db);
                resultsSnap.docs.forEach(doc => {
                    resultsBatch.delete(doc.ref);
                });
                await resultsBatch.commit();
                logger.info(`Cleared ${resultsSnap.size} FantasyGolf-Results records for draft reset.`);
            }
        } catch (resultsError) {
            logger.error('Error clearing FantasyGolf-Results during draft reset:', resultsError);
        }

        logger.info(`Draft reset complete. ${snapshot.size} teams cleared.`);
        return snapshot.size;
    } catch (error) {
        logger.error('Error resetting draft:', error);
        throw new Error(`Failed to reset draft: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Updates the draftOrder ranking for multiple teams concurrently.
 * @param updates - Array of objects containing team ID and its new draftOrder
 */
export const updateDraftOrders = async (updates: { id: string; draftOrder: number }[]): Promise<void> => {
    try {
        logger.info(`Updating draft orders for ${updates.length} teams`);

        if (!updates || updates.length === 0) return;

        const batch = writeBatch(db);

        updates.forEach(({ id, draftOrder }) => {
            const teamRef = doc(db, COLLECTIONS.MEZZTER_TEAMS, id);
            batch.update(teamRef, { draftOrder, updatedAt: new Date().toISOString() });
        });

        await batch.commit();
        logger.info('Draft orders updated successfully');
    } catch (error) {
        logger.error('Error updating draft orders:', error);
        throw new Error(`Failed to update draft orders: ${error instanceof Error ? error.message : String(error)}`);
    }
};
