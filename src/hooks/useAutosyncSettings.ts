import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface SyncSetting {
    enabled: boolean;
    cron: string;
    lastRun?: string;
    lastLog?: string;
}

export interface AutosyncSettings {
    rankings: SyncSetting;
    schedule: SyncSetting;
    tournamentField: SyncSetting;
    tournamentResults: SyncSetting;
    scorecards: SyncSetting;
    teeTimes: SyncSetting;
    activeTournamentId: string;
    activeYear: number;
    activeRound: number;
    tournamentDetectionMode: 'auto' | 'manual';
    autoDetectedTournamentName?: string;
    lastAutoDetection?: string;  // ISO timestamp
}

const DEFAULT_SETTINGS: AutosyncSettings = {
    rankings: { enabled: false, cron: '0 0 * * 1' },
    schedule: { enabled: false, cron: '0 0 * * 1' },
    tournamentField: { enabled: false, cron: '0 0 * * *' },
    tournamentResults: { enabled: false, cron: 'every 60 minutes' },
    scorecards: { enabled: false, cron: 'every 30 minutes' },
    teeTimes: { enabled: false, cron: '0 22 * * *' },
    activeTournamentId: '',
    activeYear: new Date().getFullYear(),
    activeRound: 1,
    tournamentDetectionMode: 'manual',
};

export const useAutosyncSettings = () => {
    const [settings, setSettings] = useState<AutosyncSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const docRef = doc(db, 'Settings', 'autosync');

        // Subscribe to changes
        const unsubscribe = onSnapshot(docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as AutosyncSettings);
                } else {
                    // Initialize if it doesn't exist
                    setDoc(docRef, DEFAULT_SETTINGS).catch(err => {
                        console.error("Failed to initialize autosync settings", err);
                    });
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching autosync settings:", err);
                setError("Failed to load settings");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const updateSettings = async (newSettings: Partial<AutosyncSettings>) => {
        setSaving(true);
        setError(null);
        try {
            const docRef = doc(db, 'Settings', 'autosync');
            await setDoc(docRef, newSettings, { merge: true });
        } catch (err: any) {
            console.error("Error saving settings:", err);
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const updateEndpoint = async (endpoint: keyof Omit<AutosyncSettings, 'activeTournamentId' | 'activeYear' | 'activeRound' | 'tournamentDetectionMode' | 'autoDetectedTournamentName' | 'lastAutoDetection'>, params: Partial<SyncSetting>) => {
        const newEndpointSetting = { ...settings[endpoint], ...params };
        await updateSettings({ [endpoint]: newEndpointSetting });
    };

    return { settings, loading, error, saving, updateSettings, updateEndpoint };
};
