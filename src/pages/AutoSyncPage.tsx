import React, { useState, useEffect } from 'react';
import { Server, Zap } from 'lucide-react';
import { db } from "../firebase";
import { collection, getDocs, query, where, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { PgaSchedule } from '../services/rapidApiService';
import {
    sync_rankings_now,
    sync_schedule_now,
    sync_tournament_field_now,
    sync_tournament_results_now,
    sync_fantasy_golf_results_now,
    sync_tee_times_now,
    clear_tournament_results_now,
    repopulate_results_now,
    seed_scorecard_sync_now,
    sync_scorecards_v2_now,
    fetch_all_scorecards_now,
} from '../utils/firebaseApi';
import { useYear } from '../contexts/YearContext';
import { useAutosyncSettings } from '../hooks/useAutosyncSettings';
import SyncSettingCard from '../components/SyncSettingCard';

const AutoSyncPage: React.FC = () => {
    const { year } = useYear();
    const [loading, setLoading] = useState(false);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [fantasyGolfLoading, setFantasyGolfLoading] = useState(false);
const [clearLoading, setClearLoading] = useState(false);
    const [repopulateLoading, setRepopulateLoading] = useState(false);
    const [migrateScorecardsLoading, setMigrateScorecardsLoading] = useState(false);
    const [teeTimesLoading, setTeeTimesLoading] = useState(false);
    const [seedScorecardLoading, setSeedScorecardLoading] = useState(false);
    const [scorecardsV2Loading, setScorecardsV2Loading] = useState(false);
    const [fetchAllScorecardsLoading, setFetchAllScorecardsLoading] = useState(false);

    const [detecting, setDetecting] = useState(false);

    const [logs, setLogs] = useState<string[]>([]);
    const [tournaments, setTournaments] = useState<PgaSchedule[]>([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
    const [selectedRound, setSelectedRound] = useState<string>('1');

    const { settings, loading: settingsLoading, updateEndpoint, updateSettings } = useAutosyncSettings();

    const loadTournamentList = async (forYear: number) => {
        if (!forYear) return;
        try {
            const scheduleCollectionRef = collection(db, "PGA-Schedule");
            const q = query(scheduleCollectionRef, where("year", "==", forYear));
            const querySnapshot = await getDocs(q);
            const fetchedTournaments: PgaSchedule[] = [];
            // Convert Firestore Timestamps to ISO strings for consistent in-memory representation
            const tsToIso = (val: any): string | null => {
                if (!val) return null;
                if (typeof val === 'string') return val;
                if (typeof val.toDate === 'function') return val.toDate().toISOString();
                if (typeof val.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
                return null;
            };

            querySnapshot.forEach(doc => {
                const data = doc.data();
                fetchedTournaments.push({
                    tournId: data.tournId,
                    tournName: data.tournName || data.name || data.tournId || 'Unknown Tournament',
                    year: data.year,
                    startDate: tsToIso(data.startDate),
                    endDate: tsToIso(data.endDate),
                    weekNumber: data.weekNumber ?? null,
                    format: data.format || '',
                    purse: data.purse ?? 0,
                    winnersShare: data.winnersShare ?? null,
                    fedexCupPoints: data.fedexCupPoints ?? null,
                } as PgaSchedule);
            });
            setTournaments(fetchedTournaments.sort((a, b) => String(a.tournName || '').localeCompare(String(b.tournName || ''))));
        } catch (error) {
            console.error("Error loading tournament list:", error);
        }
    };

    useEffect(() => {
        loadTournamentList(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year]);

    // Select tournament only once both the tournament list AND settings have fully loaded.
    // This eliminates the race condition where tournaments load before settings, causing
    // the dropdown (and handlers) to default to the alphabetically-first tournament.
    useEffect(() => {
        if (settingsLoading || tournaments.length === 0) return;
        const activeId = settings.activeTournamentId;
        const hasActive = activeId && tournaments.some(t => t.tournId === activeId);
        setSelectedTournamentId(hasActive ? activeId : tournaments[0].tournId);
        if (settings.activeRound) {
            setSelectedRound(settings.activeRound.toString());
        }
    }, [tournaments, settingsLoading, settings.activeTournamentId, settings.activeRound]);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    }

    const recordSyncLog = async (type: string, status: 'success' | 'error' | 'no-op', message: string, tournIdParam?: string, roundIdParam?: number) => {
        try {
            const logsRef = collection(db, 'SyncLogs');
            await addDoc(logsRef, {
                timestamp: serverTimestamp(),
                type,
                status,
                message,
                ...(tournIdParam ? { tournamentId: tournIdParam } : {}),
                ...(roundIdParam ? { roundId: roundIdParam } : {})
            });
        } catch (e) {
            console.error("Failed to write manual sync log:", e);
        }
    };

    const handleSyncRankings = async () => {
        setLoading(true);
        setLogs([]);
        addLog(`Starting ranking sync...`);
        try {
            const result = await sync_rankings_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error syncing rankings: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncSchedule = async () => {
        setScheduleLoading(true);
        setLogs([]);
        addLog(`Starting schedule sync for year ${year}...`);
        try {
            const result = await sync_schedule_now();
            addLog(result.message);
            await loadTournamentList(year);
        } catch (error) {
            addLog(`Error syncing schedule: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setScheduleLoading(false);
        }
    };

    const handleSyncTournamentPlayers = async () => {
        setPlayerLoading(true);
        setLogs([]);
        addLog(`Starting tournament field sync...`);
        try {
            const result = await sync_tournament_field_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error syncing tournament field: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setPlayerLoading(false);
        }
    };

    const handleSyncTournamentResults = async () => {
        if (!selectedTournamentId) {
            addLog("Please select a tournament first.");
            return;
        }

        setResultsLoading(true);
        setLogs([]);
        addLog(`Starting results sync for tournament ${selectedTournamentId}, Year ${year}, Round ${selectedRound}...`);
        try {
            const result = await sync_tournament_results_now({ tournId: selectedTournamentId, year, roundId: selectedRound });
            addLog(result.message);
        } catch (error) {
            addLog(`Error syncing results: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setResultsLoading(false);
        }
    };

    const handleForceSyncFantasyGolfResults = async () => {
        if (!selectedTournamentId) {
            addLog("Please select a tournament first.");
            return;
        }

        setFantasyGolfLoading(true);
        setLogs([]);
        addLog(`Starting full FantasyGolf-Results sync for tournament ${selectedTournamentId} (All Rounds 1-4)...`);
        try {
            const result = await sync_fantasy_golf_results_now({ tournId: selectedTournamentId, year });
            addLog(result.message);
        } catch (error) {
            addLog(`Error syncing FantasyGolf results: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setFantasyGolfLoading(false);
        }
    };

    const handleClearTournamentResults = async () => {
        if (!selectedTournamentId) {
            addLog("Please select a tournament first.");
            return;
        }

        if (!window.confirm(`Are you sure you want to clear all parsed results for tournament ${selectedTournamentId}? This action cannot be undone.`)) {
            return;
        }

        setClearLoading(true);
        setLogs([]);
        addLog(`Clearing all parsed results for tournament ${selectedTournamentId}...`);
        try {
            const result = await clear_tournament_results_now({ tournId: selectedTournamentId, year });
            addLog(result.message);
        } catch (error) {
            addLog(`Error clearing results: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setClearLoading(false);
        }
    };

    const handleRepopulateTournamentResults = async () => {
        if (!selectedTournamentId) {
            addLog("Please select a tournament first.");
            return;
        }

        setRepopulateLoading(true);
        setLogs([]);
        addLog(`Repopulating parsed results from raw data for tournament ${selectedTournamentId}...`);
        try {
            const result = await repopulate_results_now({ tournId: selectedTournamentId, year });
            addLog(result.message);
        } catch (error) {
            addLog(`Error repopulating results: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setRepopulateLoading(false);
        }
    };

    const handleDetectCurrentTournament = async () => {
        setDetecting(true);
        setLogs([]);
        addLog(`Auto-detecting current tournament from PGA Schedule (${year})...`);

        const now = Date.now();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        // Dates are always ISO strings in the in-memory PgaSchedule (converted on load from Firestore)
        const toMs = (val: string | null | undefined): number => {
            if (!val) return 0;
            const d = new Date(val);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        };

        let found: PgaSchedule | null = null;
        let detectedRound = 1;
        let nextUpcoming: PgaSchedule | null = null;
        let nextUpcomingMs = Infinity;

        addLog(`Checking ${tournaments.length} tournaments...`);

        for (const t of tournaments) {
            const startMs = toMs(t.startDate);
            const endMs = toMs(t.endDate);
            if (!startMs || !endMs) {
                addLog(`  Skipping ${t.tournName || t.tournId}: invalid dates (start=${t.startDate}, end=${t.endDate})`);
                continue;
            }

            const endOfTournament = endMs + MS_PER_DAY - 1;
            if (now >= startMs && now <= endOfTournament) {
                found = t;
                const daysIn = Math.floor((now - startMs) / MS_PER_DAY);
                detectedRound = Math.min(4, Math.max(1, daysIn + 1));
                break;
            }

            // Track next upcoming for fallback
            if (startMs > now && startMs < nextUpcomingMs) {
                nextUpcoming = t;
                nextUpcomingMs = startMs;
            }
        }

        if (found) {
            const tournName = found.tournName || found.tournId;
            addLog(`Detected active: ${tournName} — Round ${detectedRound}`);
            await updateSettings({
                activeTournamentId: found.tournId,
                activeYear: year,
                activeRound: detectedRound,
                autoDetectedTournamentName: tournName,
                lastAutoDetection: new Date().toISOString(),
            });
            await recordSyncLog('tournamentDetection', 'success', `[Manual] Detected: ${tournName} Round ${detectedRound}`, found.tournId, detectedRound);
            setSelectedTournamentId(found.tournId);
            setSelectedRound(detectedRound.toString());
            addLog('Settings updated successfully.');
        } else if (nextUpcoming) {
            const tournName = nextUpcoming.tournName || nextUpcoming.tournId;
            const startDate = new Date(nextUpcomingMs).toLocaleDateString();
            addLog(`No active tournament. Next up: ${tournName} (starts ${startDate})`);
            await updateSettings({
                activeTournamentId: nextUpcoming.tournId,
                activeYear: year,
                activeRound: 1,
                autoDetectedTournamentName: `${tournName} (upcoming)`,
                lastAutoDetection: new Date().toISOString(),
            });
            await recordSyncLog('tournamentDetection', 'success', `[Manual] No active tournament — pre-configured for: ${tournName}`, nextUpcoming.tournId, 1);
            setSelectedTournamentId(nextUpcoming.tournId);
            setSelectedRound('1');
            addLog('Settings updated with next upcoming tournament.');
        } else {
            addLog('No active or upcoming tournaments found for this year.');
            await updateSettings({
                autoDetectedTournamentName: '',
                lastAutoDetection: new Date().toISOString(),
            });
            await recordSyncLog('tournamentDetection', 'no-op', `[Manual] No active tournament found for ${year}.`);
        }

        setDetecting(false);
    };

const handleSyncTeeTimes = async () => {
        setTeeTimesLoading(true);
        setLogs([]);
        addLog(`Starting tee time sync...`);
        try {
            const result = await sync_tee_times_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error syncing tee times: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setTeeTimesLoading(false);
        }
    };

    const handleSyncScorecardsV2 = async () => {
        setScorecardsV2Loading(true);
        setLogs([]);
        addLog(`Running Scorecards V2 sync (Scorecard-Sync → API)...`);
        try {
            const result = await sync_scorecards_v2_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error running Scorecards V2 sync: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setScorecardsV2Loading(false);
        }
    };

    const handleFetchAllScorecards = async () => {
        setFetchAllScorecardsLoading(true);
        setLogs([]);
        addLog(`Fetching all scorecards for the active tournament (all players, all rounds)...`);
        try {
            const result = await fetch_all_scorecards_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error fetching all scorecards: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setFetchAllScorecardsLoading(false);
        }
    };

    const handleSeedScorecardSync = async () => {
        setSeedScorecardLoading(true);
        setLogs([]);
        addLog(`Seeding Scorecard-Sync from TeeTimes...`);
        try {
            const result = await seed_scorecard_sync_now();
            addLog(result.message);
        } catch (error) {
            addLog(`Error seeding Scorecard-Sync: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setSeedScorecardLoading(false);
        }
    };

    const handleMigrateScorecards = async () => {
        if (!window.confirm('Migrate all Player-Scorecards to deterministic IDs (year-tournId-playerId-round)? Old auto-ID docs will be deleted. This cannot be undone.')) return;

        setMigrateScorecardsLoading(true);
        setLogs([]);
        addLog('Reading all Player-Scorecards documents...');

        try {
            const snapshot = await getDocs(collection(db, 'Player-Scorecards'));
            addLog(`Found ${snapshot.size} total documents.`);

            let migrated = 0;
            let skipped = 0;
            let errors = 0;

            // Firestore batch limit is 500 ops; each migration = 1 set + 1 delete = 2 ops → 250 pairs per batch
            const BATCH_SIZE = 250;
            let batch = writeBatch(db);
            let batchOps = 0;

            const commitBatch = async () => {
                if (batchOps > 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchOps = 0;
                }
            };

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const tournId = String(data.tournId ?? '');
                const playerId = String(data.playerId ?? '');
                const roundId = data.roundId ?? '';
                const yearRaw = data.year;

                if (!tournId || !playerId || roundId === '' || yearRaw == null) {
                    addLog(`Skipping ${docSnap.id}: missing required fields`);
                    errors++;
                    continue;
                }

                const yearNum = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw), 10);
                const deterministicId = `${yearNum}-${tournId}-${playerId}-${roundId}`;

                if (docSnap.id === deterministicId) {
                    skipped++;
                    continue;
                }

                try {
                    const newDocRef = doc(db, 'Player-Scorecards', deterministicId);
                    batch.set(newDocRef, { ...data, year: yearNum }, { merge: true });
                    batch.delete(docSnap.ref);
                    batchOps += 2;
                    migrated++;

                    if (batchOps >= BATCH_SIZE * 2) {
                        await commitBatch();
                        addLog(`Progress: ${migrated} migrated, ${skipped} already correct, ${errors} errors...`);
                    }
                } catch (err) {
                    errors++;
                    addLog(`Error migrating ${docSnap.id}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            await commitBatch();
            addLog(`Migration complete! ${migrated} migrated, ${skipped} already had correct IDs, ${errors} errors.`);
            await recordSyncLog('scorecards', errors === 0 ? 'success' : 'error',
                `Scorecard ID migration: ${migrated} migrated, ${skipped} skipped, ${errors} errors.`);
        } catch (err) {
            addLog(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setMigrateScorecardsLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-green-700">
                <div>
                    <h1 className="page-title flex items-center">
                        <Server className="w-8 h-8 mr-3 text-purple-400" />
                        API Auto-Sync Settings
                    </h1>
                    <p className="mt-2 text-green-100">
                        Configure background RapidAPI synchronization for the current active year ({year}). Only administrators can view this page.
                    </p>
                </div>
                <div className="hidden sm:block text-lg font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                    Active Year: <span className="text-green-800 font-bold">{year}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sync Controls Column */}
                <div className="space-y-8">

                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold">Target Synchronization Filter</h2>
                            {!settingsLoading && (
                                <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
                                    <button
                                        onClick={() => updateSettings({ tournamentDetectionMode: 'manual' })}
                                        className={`px-3 py-1.5 font-medium transition ${(settings.tournamentDetectionMode ?? 'manual') === 'manual' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        Manual
                                    </button>
                                    <button
                                        onClick={() => updateSettings({ tournamentDetectionMode: 'auto' })}
                                        className={`px-3 py-1.5 font-medium transition ${settings.tournamentDetectionMode === 'auto' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        Auto-Detect
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Auto-detect mode */}
                        {settings.tournamentDetectionMode === 'auto' && (
                            <div className="space-y-3">
                                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-blue-800 mb-1">Auto-detected tournament</p>
                                            {settings.autoDetectedTournamentName ? (
                                                <p className="text-base font-bold text-blue-900 truncate">
                                                    {settings.autoDetectedTournamentName}
                                                    <span className="ml-2 font-normal text-sm text-blue-700">— Round {settings.activeRound}</span>
                                                </p>
                                            ) : (
                                                <p className="text-sm text-blue-700 italic">No active tournament detected</p>
                                            )}
                                            {settings.lastAutoDetection && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Last checked: {new Date(settings.lastAutoDetection).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleDetectCurrentTournament}
                                            disabled={detecting || tournaments.length === 0}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition shrink-0"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            {detecting ? 'Detecting...' : 'Detect Now'}
                                        </button>
                                    </div>
                                    {tournaments.length === 0 && (
                                        <p className="text-xs text-red-500 mt-2">No schedule loaded for {year}. Sync PGA Schedule first.</p>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 p-3 bg-gray-50 border border-gray-200 rounded">
                                    The scheduled Cloud Function runs daily at midnight to detect the active tournament automatically.
                                    Use <strong>Detect Now</strong> to trigger detection immediately.
                                </div>
                            </div>
                        )}

                        {/* Manual mode */}
                        {(settings.tournamentDetectionMode ?? 'manual') === 'manual' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Tournament</label>
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-green-500 focus:border-green-500"
                                            value={selectedTournamentId}
                                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                                        >
                                            <option value="">-- Select a Tournament --</option>
                                            {tournaments.map(t => {
                                                let dateDisplay = '';
                                                if (t.startDate) {
                                                    const d = new Date(t.startDate);
                                                    if (!isNaN(d.getTime())) {
                                                        dateDisplay = ` (${d.toLocaleDateString()})`;
                                                    }
                                                }
                                                return (
                                                    <option key={t.tournId} value={t.tournId}>{t.tournName}{dateDisplay}</option>
                                                );
                                            })}
                                        </select>
                                        {tournaments.length === 0 && (
                                            <p className="text-xs text-red-500 mt-1">No tournaments found for {year}. Sync schedule first.</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Round</label>
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-green-500 focus:border-green-500"
                                            value={selectedRound}
                                            onChange={(e) => setSelectedRound(e.target.value)}
                                        >
                                            <option value="1">Round 1 (Thursday)</option>
                                            <option value="2">Round 2 (Friday)</option>
                                            <option value="3">Round 3 (Saturday)</option>
                                            <option value="4">Round 4 (Sunday)</option>
                                        </select>
                                    </div>
                                </div>

                                {!settingsLoading && (
                                    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                                        <h3 className="font-bold text-green-800 mb-2">Target Autosync Values</h3>
                                        <p className="text-sm text-green-700 mb-2">Updates Firestore so cloud functions know which tournament to sync continuously.</p>
                                        <button
                                            onClick={() => updateSettings({ activeTournamentId: selectedTournamentId, activeYear: year, activeRound: parseInt(selectedRound) })}
                                            className="btn-primary w-full text-sm py-1"
                                            disabled={settings.activeTournamentId === selectedTournamentId && settings.activeYear === year && settings.activeRound === parseInt(selectedRound)}
                                        >
                                            Set as Active Target
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Always-visible current state */}
                        {!settingsLoading && (
                            <div className="mt-3 text-xs text-gray-500 border-t pt-3">
                                <span className="font-medium">Active target:</span>{' '}
                                {settings.activeTournamentId
                                    ? <span className="font-mono">{settings.activeTournamentId}</span>
                                    : <span className="italic">None</span>
                                }
                                {' · '}{settings.activeYear} / R{settings.activeRound}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <h2 className="text-2xl font-bold mb-4">Fantasy Golf League Manual Sync</h2>
                        <p className="text-gray-600 mb-4 text-sm">Regenerate FantasyGolf-Results from existing Tournament-Results explicitly (no RapidAPI call).</p>
                        <button
                            onClick={handleForceSyncFantasyGolfResults}
                            className="btn-secondary w-full"
                            disabled={fantasyGolfLoading || !selectedTournamentId}
                        >
                            {fantasyGolfLoading ? 'Syncing...' : 'Force Sync FantasyGolf Results'}
                        </button>

                        <div className="mt-8 border-t pt-6 bg-red-50 -mx-6 px-6 pb-6 -mb-6 rounded-b-lg border-red-100">
                            <h3 className="font-bold mb-2 text-red-800">Danger Zone / Recovery</h3>
                            <p className="text-sm text-red-600 mb-4">
                                If the leaderboard or FantasyGolf-Results look out of sync, first <span className="font-semibold">Clear Parsed Results</span> and then
                                <span className="font-semibold"> Repopulate from Raw</span> for this tournament. Once parsed Tournament-Results are rebuilt,
                                run a full FantasyGolf sync above to refresh FantasyGolf-Results for all rounds.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleClearTournamentResults}
                                    className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-md font-semibold text-sm hover:bg-red-200 transition disabled:opacity-50 flex-1"
                                    disabled={clearLoading || !selectedTournamentId}
                                >
                                    {clearLoading ? 'Clearing...' : 'Clear Parsed Results'}
                                </button>

                                <button
                                    onClick={handleRepopulateTournamentResults}
                                    className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-300 rounded-md font-semibold text-sm hover:bg-blue-200 transition disabled:opacity-50 flex-1"
                                    disabled={repopulateLoading || !selectedTournamentId}
                                >
                                    {repopulateLoading ? 'Repopulating...' : 'Repopulate from Raw'}
                                </button>
                            </div>

                            <div className="mt-4 pt-4 border-t border-red-200">
                                <p className="text-sm text-gray-600 mb-2">
                                    One-time migration: rename all auto-ID scorecard docs to the new <code className="text-xs bg-gray-100 px-1 rounded">year-tournId-playerId-round</code> format and delete the old docs.
                                </p>
                                <button
                                    onClick={handleMigrateScorecards}
                                    className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-300 rounded-md font-semibold text-sm hover:bg-purple-200 transition disabled:opacity-50 w-full"
                                    disabled={migrateScorecardsLoading}
                                >
                                    {migrateScorecardsLoading ? 'Migrating...' : 'Migrate Scorecard IDs'}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Server Autosync Column */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Server Autosync Settings</h2>
                    <p className="text-gray-600 mb-4 text-sm">Configure Cloud Functions schedule. Warning: Frequent syncs consume RapidAPI quota.</p>
                    {settingsLoading ? (
                        <p className="text-gray-500 italic">Loading settings...</p>
                    ) : (
                        <div className="space-y-4">
                            <SyncSettingCard
                                settingKey="rankings"
                                label="OWGR"
                                val={settings.rankings}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncRankings}
                                isRunning={loading}
                            />
                            <SyncSettingCard
                                settingKey="schedule"
                                label="PGA Schedule"
                                val={settings.schedule}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncSchedule}
                                isRunning={scheduleLoading}
                            />
                            <SyncSettingCard
                                settingKey="tournamentField"
                                label="Tournament Field"
                                val={settings.tournamentField}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncTournamentPlayers}
                                isRunning={playerLoading}
                            />
                            <SyncSettingCard
                                settingKey="tournamentResults"
                                label="Tournament Results"
                                val={settings.tournamentResults}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncTournamentResults}
                                isRunning={resultsLoading}
                            />
                            <SyncSettingCard
                                settingKey="teeTimes"
                                label="Tee Times"
                                val={settings.teeTimes ?? { enabled: false, cron: '0 22 * * *' }}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncTeeTimes}
                                isRunning={teeTimesLoading}
                                onRunAll={handleSeedScorecardSync}
                                isRunningAll={seedScorecardLoading}
                            />
                            <SyncSettingCard
                                settingKey="scorecards"
                                label="Player Scorecards"
                                val={settings.scorecards}
                                updateEndpoint={updateEndpoint}
                                onRunNow={handleSyncScorecardsV2}
                                isRunning={scorecardsV2Loading}
                                onRunAll={handleFetchAllScorecards}
                                isRunningAll={fetchAllScorecardsLoading}
                            />
                        </div>
                    )}
                </div>
            </div>

            {logs.length > 0 && (
                <div className="card mt-8">
                    <h3 className="text-xl font-bold mb-4">Manual Sync Log Output</h3>
                    <div className="bg-gray-100 p-4 rounded-lg max-h-60 overflow-y-auto font-mono text-sm">
                        {logs.map((log, index) => (
                            <p key={index} className="whitespace-pre-wrap">{log}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoSyncPage;
