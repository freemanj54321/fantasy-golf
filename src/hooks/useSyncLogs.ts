import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { SyncLog } from '../types';

export const useSyncLogs = (type: string) => {
    const [latestLog, setLatestLog] = useState<SyncLog | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLatestLog = async () => {
        setLoading(true);
        setError(null);
        try {
            const logsRef = collection(db, 'SyncLogs');
            const q = query(
                logsRef,
                where('type', '==', type),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const docSnap = snapshot.docs[0];
                setLatestLog({
                    id: docSnap.id,
                    ...docSnap.data()
                } as SyncLog);
            } else {
                setLatestLog(null);
            }
        } catch (err: any) {
            console.error(`Error fetching latest sync log for ${type}:`, err);
            // It's possible the index is missing, in which case we shouldn't crash the UI but just show no log or simple error.
            setError(err.message || 'Failed to loaded log');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLatestLog();
        // Set up a simple interval to refresh the log every 1 minute so it stays fresh if the user stays on the page
        const intervalId = setInterval(fetchLatestLog, 60000);
        return () => clearInterval(intervalId);
    }, [type]);

    return { latestLog, loading, error, refetch: fetchLatestLog };
};
