import {
    doc,
    onSnapshot,
    setDoc,
    updateDoc,
    getDoc,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import { LeagueSettings } from '../types';

const LEAGUE_SETTINGS_COLLECTION = 'League-Settings';

class LeagueServiceLogger {
    private prefix = '[LeagueService]';

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

const logger = new LeagueServiceLogger();

/**
 * Initializes default league settings for a given year if they do not exist
 */
export const initializeLeagueSettings = async (year: number): Promise<void> => {
    try {
        const docRef = doc(db, LEAGUE_SETTINGS_COLLECTION, year.toString());
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            logger.info(`Initializing default league settings for year ${year}`);
            const defaultSettings: LeagueSettings = {
                year,
                teamCount: 0,
                playersPerTeam: 3,
                draftStatus: 'pre-draft',
                // tournamentLogoUrl is optional, defaults to Trophy icon
            };

            await setDoc(docRef, defaultSettings);
            logger.info(`Successfully created default league settings for ${year}`);
        }
    } catch (error) {
        logger.error(`Error initializing league settings for ${year}:`, error);
    }
};

/**
 * Subscribes to the real-time league settings for a specific year
 * @param year - The league year
 * @param onUpdate - Callback fired when settings document updates
 * @returns Unsubscribe function
 */
export const subscribeToLeagueSettings = (
    year: number,
    onUpdate: (settings: LeagueSettings | null) => void
): Unsubscribe => {
    logger.info(`Subscribing to League Settings for year ${year}`);

    const docRef = doc(db, LEAGUE_SETTINGS_COLLECTION, year.toString());

    return onSnapshot(
        docRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as LeagueSettings;
                onUpdate(data);
            } else {
                logger.warn(`League settings for year ${year} not found.`);
                onUpdate(null);
            }
        },
        (error) => {
            logger.error('Error in league settings subscription:', error);
            onUpdate(null);
        }
    );
};

/**
 * Updates the draft status of the current league year
 * @param year - The league year
 * @param status - The new draft status
 */
export const updateDraftStatus = async (
    year: number,
    status: 'pre-draft' | 'in-progress' | 'complete'
): Promise<void> => {
    try {
        logger.info(`Updating draft status for ${year} to '${status}'`);
        const docRef = doc(db, LEAGUE_SETTINGS_COLLECTION, year.toString());
        await updateDoc(docRef, {
            draftStatus: status,
        });
        logger.info(`Draft status updated successfully`);
    } catch (error) {
        logger.error(`Error updating draft status for ${year}:`, error);
        throw new Error(`Failed to update draft status: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Updates any of the league settings for a specific year
 * @param year - The league year
 * @param updates - Partial settings block
 */
export const updateLeagueSettings = async (
    year: number,
    updates: Partial<LeagueSettings>
): Promise<void> => {
    try {
        logger.info(`Updating league settings for year ${year}`);
        const docRef = doc(db, LEAGUE_SETTINGS_COLLECTION, year.toString());
        await updateDoc(docRef, updates);
        logger.info(`League settings updated successfully`);
    } catch (error) {
        logger.error(`Error updating league settings for ${year}:`, error);
        throw new Error(`Failed to update league settings: ${error instanceof Error ? error.message : String(error)}`);
    }
}
