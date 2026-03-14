import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { apiClient, GOLF_API_HOST, DEFAULT_ORG_ID, SyncResult } from './apiClient';
import { Logger } from '../lib/logger';

const logger = new Logger('Scorecard');

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

const transformNumberInt = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (typeof obj === 'object' && '$numberInt' in obj && typeof (obj as Record<string, unknown>)['$numberInt'] === 'string' && Object.keys(obj).length === 1) {
        return parseInt((obj as Record<string, string>)['$numberInt'], 10) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(transformNumberInt) as T;
    }

    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = transformNumberInt((obj as Record<string, unknown>)[key]);
        }
    }
    return newObj as T;
};

const fetchPlayerScorecard = async (tournId: string, year: string, playerId: string): Promise<ScorecardRound[]> => {
    const url = `https://${GOLF_API_HOST}/scorecard?orgId=${DEFAULT_ORG_ID}&tournId=${tournId}&year=${year}&playerId=${playerId}`;
    const raw = await apiClient.get<unknown>(url, { useCache: false });
    // Normalize: API may return a bare array or wrap it in an object
    let data: unknown;
    if (Array.isArray(raw)) {
        data = raw;
    } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.rounds)) data = obj.rounds;
        else if (Array.isArray(obj.scorecards)) data = obj.scorecards;
        else {
            logger.warn(`Unexpected scorecard response shape for player ${playerId}`);
            return [];
        }
    } else {
        return [];
    }
    return transformNumberInt(data as ScorecardRound[]);
};

export const savePlayerScorecard = async (tournId: string, year: string, playerId: string): Promise<SyncResult> => {
    try {
        const scorecardRounds = await fetchPlayerScorecard(tournId, year, playerId);
        if (!scorecardRounds || scorecardRounds.length === 0) {
            logger.warn(`No scorecard found for player ${playerId} in tournament ${tournId}`);
            return { createdCount: 0, updatedCount: 0 };
        }

        const yearNum = parseInt(year, 10);
        const batch = writeBatch(db);
        let count = 0;

        for (const round of scorecardRounds) {
            const docId = `${yearNum}-${tournId}-${playerId}-${round.roundId}`;
            const docRef = doc(db, "Player-Scorecards", docId);
            batch.set(docRef, {
                ...round,
                year: yearNum,
                lastUpdated: new Date()
            }, { merge: true });
            count++;
        }

        if (count > 0) {
            await batch.commit();
            logger.info(`Scorecard sync complete for player ${playerId}: ${count} rounds upserted.`);
        }

        return { createdCount: 0, updatedCount: count };
    } catch (error) {
        logger.error(`Error saving scorecard for player ${playerId}:`, error);
        throw error;
    }
};
