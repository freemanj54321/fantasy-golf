import { useState, useEffect } from 'react';
import { useYear } from '../contexts/YearContext';
import { initializeLeagueSettings, subscribeToLeagueSettings } from '../services/leagueService';
import { LeagueSettings } from '../types';
interface UseLeagueSettingsReturn {
    settings: LeagueSettings;
    loading: boolean;
    error: string | null;
}

const useLeagueSettings = (): UseLeagueSettingsReturn => {
    const { year } = useYear();
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<LeagueSettings>({
        year,
        teamCount: 0,
        playersPerTeam: 3,
        draftStatus: 'pre-draft',
        tournamentLogoUrl: "",
    });

    useEffect(() => {
        let unsubscribe: () => void;
        setLoading(true);

        const setupSettings = () => {
            // Subscribe immediately — onSnapshot fires from cache, handles missing doc
            unsubscribe = subscribeToLeagueSettings(year, (liveSettings) => {
                if (liveSettings) {
                    setSettings({
                        ...liveSettings,
                        // Fallback logo if it was not present in Firestore
                        tournamentLogoUrl: liveSettings.tournamentLogoUrl || ""
                    });
                }
                setLoading(false);
            });

            // Fire-and-forget: creates default doc only if it doesn't exist yet
            initializeLeagueSettings(year).catch((err) => {
                console.error("Failed to initialize league settings", err);
            });
        };

        setupSettings();

        // Cleanup subscription on unmount or year change
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [year]);

    return { settings, loading, error };
};

export default useLeagueSettings;
