import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Golfer } from '../types';

const unwrapValue = (val: any): any => {
    if (val && typeof val === 'object' && val.$numberInt) {
        return parseInt(val.$numberInt, 10);
    }
    return val;
};

export const fetchAvailableGolfers = async (year?: number, tournamentId?: string): Promise<Golfer[]> => {
    try {
        // 1. Fetch from 'Tournament-Field' collection
        const fieldRef = collection(db, 'Tournament-Field');
        let fieldQuery;

        if (year && tournamentId) {
            fieldQuery = query(fieldRef, where('year', '==', year), where('tournId', '==', tournamentId));
        } else if (year) {
            fieldQuery = query(fieldRef, where('year', '==', year));
        } else if (tournamentId) {
            fieldQuery = query(fieldRef, where('tournId', '==', tournamentId));
        } else {
            fieldQuery = query(fieldRef);
        }

        const fieldSnapshot = await getDocs(fieldQuery);

        if (fieldSnapshot.empty) {
            console.warn(`No players found in Tournament-Field${year ? ` for year ${year}` : ''}${tournamentId ? ` for tournament ${tournamentId}` : ''}.`);
            return [];
        }

        // 2. Fetch from 'golf-rankings' collection to get World Rank
        const rankingsRef = collection(db, 'golf-rankings');
        const rankingsQuery = query(rankingsRef);
        const rankingsSnapshot = await getDocs(rankingsQuery);

        const rankMap = new Map<string, number>();
        rankingsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.playerId && data.rank) {
                rankMap.set(String(unwrapValue(data.playerId)), unwrapValue(data.rank));
            }
        });

        const golfersMap = new Map<string, Golfer>();

        fieldSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const fullName = data.fullName || data.name || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : "Unknown");
            const playerId = String(unwrapValue(data.playerId) || doc.id);

            // Skip if we already added this player
            if (golfersMap.has(playerId)) return;

            // Get rank from the map, fallback to existing rank in data, or 999
            const rank = rankMap.get(playerId) || unwrapValue(data.rank) || 999;

            golfersMap.set(playerId, {
                id: playerId,
                name: fullName,
                rank: rank,
                country: data.country || "USA",
                odds: data.odds || "E"
            } as Golfer);
        });

        const golfers = Array.from(golfersMap.values());

        // Client-side sort: By Rank (Ascending), then by Name
        return golfers.sort((a, b) => {
            if (a.rank !== b.rank) {
                return a.rank - b.rank;
            }
            return a.name.localeCompare(b.name);
        });

    } catch (error) {
        console.error("Error fetching available golfers:", error);
        return [];
    }
};
