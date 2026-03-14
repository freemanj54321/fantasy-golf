import React, { useState, useEffect } from 'react';
import {
    X, Trophy, RefreshCw, Save, AlertTriangle, CheckCircle,
    ChevronDown, ChevronUp, Edit, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useYear } from '../contexts/YearContext';
import { SeasonRecord, TeamSeasonRecord, Team } from '../types';
import { computeSeasonRecord, saveSeasonRecord, buildSeasonRecordFromTeams } from '../services/seasonRecordsService';

interface FinalizeSeasonModalProps {
    onClose: () => void;
    onSaved: (record: SeasonRecord) => void;
    /** Pre-load an existing record for editing (re-finalize flow) */
    existingRecord?: SeasonRecord | null;
    /** Pre-fill tournament ID (e.g. passed from the leaderboard) */
    initialTournamentId?: string;
    /** Pre-fill tournament name */
    initialTournamentName?: string;
    /** Lock the season year (e.g. when launched from the leaderboard) */
    lockedYear?: number;
    /** Live Team[] already shown on the leaderboard — scores are taken directly from here */
    leaderboardTeams?: Team[];
}

const EMPTY_WINNER = { name: '', playerId: '', totalToPar: '' as string, country: '' };

const FinalizeSeasonModal: React.FC<FinalizeSeasonModalProps> = ({ onClose, onSaved, existingRecord, initialTournamentId, initialTournamentName, lockedYear, leaderboardTeams }) => {
    const { year: contextYear } = useYear();
    const defaultYear = existingRecord?.year ?? lockedYear ?? contextYear;

    // Season year (editable unless locked)
    const [seasonYear, setSeasonYear] = useState(defaultYear);

    // Manual vs computed mode
    const [manualMode, setManualMode] = useState(false);

    // Compute state
    const [tournamentId, setTournamentId] = useState(existingRecord?.tournamentId ?? initialTournamentId ?? '014');
    const [tournamentName, setTournamentName] = useState(existingRecord?.tournamentName ?? initialTournamentName ?? 'The Masters');
    const [computing, setComputing] = useState(false);
    const [computeError, setComputeError] = useState<string | null>(null);
    const [preview, setPreview] = useState<SeasonRecord | null>(existingRecord ?? null);

    // Winner override — normalized to EMPTY_WINNER shape so state type stays consistent
    const [winner, setWinner] = useState(existingRecord?.tournamentWinner
        ? {
            name: existingRecord.tournamentWinner.name,
            playerId: existingRecord.tournamentWinner.playerId ?? '',
            totalToPar: String(existingRecord.tournamentWinner.totalToPar ?? ''),
            country: existingRecord.tournamentWinner.country ?? '',
        }
        : EMPTY_WINNER);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Manual mode — team list editor
    const [manualTeams, setManualTeams] = useState<TeamSeasonRecord[]>(
        existingRecord?.teams ?? []
    );

    // Expanded rows
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

    // ── Compute ──────────────────────────────────────────────────────────────

    const runCompute = async (
        source: 'leaderboard' | 'database',
        yr: number,
        tid: string,
        tname: string,
        currentWinner: typeof EMPTY_WINNER,
    ) => {
        setComputeError(null);
        setPreview(null);
        setComputing(true);
        try {
            const record = source === 'leaderboard' && leaderboardTeams && leaderboardTeams.length > 0
                ? await buildSeasonRecordFromTeams(leaderboardTeams, yr, tid, tname)
                : await computeSeasonRecord(yr, tid, tname);
            setPreview({
                ...record,
                tournamentWinner: currentWinner.name ? currentWinner : record.tournamentWinner,
            });
            if (record.tournamentWinner && !currentWinner.name) {
                setWinner({
                    name: record.tournamentWinner.name,
                    playerId: record.tournamentWinner.playerId ?? '',
                    totalToPar: String(record.tournamentWinner.totalToPar ?? ''),
                    country: record.tournamentWinner.country ?? '',
                });
            }
        } catch (err: any) {
            setComputeError(err.message ?? 'Computation failed.');
        } finally {
            setComputing(false);
        }
    };

    // Auto-load from leaderboard teams on mount when available (no button click needed)
    useEffect(() => {
        if (leaderboardTeams && leaderboardTeams.length > 0 && !existingRecord) {
            runCompute('leaderboard', defaultYear, initialTournamentId ?? '014', initialTournamentName ?? 'The Masters', EMPTY_WINNER);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCompute = () =>
        runCompute(
            leaderboardTeams && leaderboardTeams.length > 0 ? 'leaderboard' : 'database',
            seasonYear, tournamentId, tournamentName, winner,
        );

    // ── Save ─────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        const teams = manualMode ? manualTeams : preview?.teams;
        if (!teams || teams.length === 0) {
            setSaveError('No team data to save.');
            return;
        }

        setSaveError(null);
        setSaving(true);
        try {
            const base = preview ?? {
                year: seasonYear,
                tournamentId,
                tournamentName,
                teams,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const record: SeasonRecord = {
                ...base,
                year: seasonYear,
                tournamentId,
                tournamentName,
                teams,
                tournamentWinner: winner.name
                    ? {
                        name: winner.name,
                        playerId: winner.playerId || undefined,
                        totalToPar: winner.totalToPar !== '' ? winner.totalToPar : null,
                        country: winner.country || undefined,
                    }
                    : null,
                lockedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdAt: base.createdAt,
            };

            await saveSeasonRecord(record);
            onSaved(record);
            onClose();
        } catch (err: any) {
            setSaveError(err.message ?? 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    // ── Manual mode team helpers ──────────────────────────────────────────────

    const updateManualTeam = (idx: number, field: keyof TeamSeasonRecord, value: any) => {
        setManualTeams(prev =>
            prev.map((t, i) => i === idx ? { ...t, [field]: value } : t)
        );
    };

    const addManualTeam = () => {
        const newTeam: TeamSeasonRecord = {
            teamId: `manual_${Date.now()}`,
            teamName: '',
            finalPosition: manualTeams.length + 1,
            totalScore: null,
            roundScores: {},
            dailyWins: 0,
            dailyWinRounds: [],
            overallWin: manualTeams.length === 0,
            cutsEarned: 0,
            draftOrder: manualTeams.length,
            players: [],
        };
        setManualTeams(prev => [...prev, newTeam]);
    };

    const removeManualTeam = (idx: number) => {
        setManualTeams(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({
            ...t,
            finalPosition: i + 1,
            overallWin: i === 0,
        })));
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const formatScore = (score: number | null | undefined) => {
        if (score === null || score === undefined) return '—';
        if (score === 0) return 'E';
        return score > 0 ? `+${score}` : `${score}`;
    };

    const teamsToDisplay = manualMode ? manualTeams : (preview?.teams ?? []);
    const canSave = manualMode
        ? manualTeams.length > 0
        : preview !== null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <h2 className="text-xl font-bold">Finalize Season</h2>
                        {lockedYear ? (
                            <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-3 py-1 rounded-full border border-yellow-300">
                                {seasonYear}
                            </span>
                        ) : (
                            <input
                                type="number"
                                value={seasonYear}
                                onChange={e => setSeasonYear(Number(e.target.value))}
                                className="w-24 p-1 border rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                min={2020}
                                max={2099}
                            />
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">
                            {manualMode
                                ? 'Manual entry mode (for historical years)'
                                : leaderboardTeams && leaderboardTeams.length > 0
                                    ? 'Using live leaderboard data'
                                    : 'Compute from FantasyGolf-Results data'}
                        </span>
                        <button
                            onClick={() => setManualMode(v => !v)}
                            className="flex items-center text-sm text-green-700 hover:text-green-900 font-medium"
                        >
                            {manualMode
                                ? <><ToggleRight className="w-5 h-5 mr-1 text-green-700" /> Switch to Compute</>
                                : <><ToggleLeft className="w-5 h-5 mr-1 text-gray-400" /> Switch to Manual</>
                            }
                        </button>
                    </div>

                    {/* Tournament Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament ID</label>
                            <input
                                type="text"
                                value={tournamentId}
                                onChange={e => setTournamentId(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                placeholder="e.g. 014"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
                            <input
                                type="text"
                                value={tournamentName}
                                onChange={e => setTournamentName(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                placeholder="e.g. The Masters"
                            />
                        </div>
                    </div>

                    {/* Compute Button (non-manual mode) */}
                    {!manualMode && (
                        <button
                            onClick={handleCompute}
                            disabled={computing || !tournamentId}
                            className="btn-primary flex items-center"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${computing ? 'animate-spin' : ''}`} />
                            {computing
                                ? 'Loading…'
                                : preview
                                    ? (leaderboardTeams && leaderboardTeams.length > 0 ? 'Re-load from Leaderboard' : 'Re-Compute')
                                    : (leaderboardTeams && leaderboardTeams.length > 0 ? 'Load from Leaderboard' : 'Compute Stats')}
                        </button>
                    )}

                    {computeError && (
                        <div className="flex items-start p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            {computeError}
                        </div>
                    )}

                    {/* Results Preview / Manual Teams */}
                    {(teamsToDisplay.length > 0 || manualMode) && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-800">
                                    {manualMode ? 'Teams' : 'Preview'}
                                </h3>
                                {!manualMode && preview && (
                                    <span className="text-xs text-green-700 flex items-center">
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                        {preview.teams.length} teams computed
                                    </span>
                                )}
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left py-2 px-3 font-semibold text-gray-600">#</th>
                                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Team</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">Total</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">R1</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">R2</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">R3</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">R4</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600">DW</th>
                                            <th className="text-center py-2 px-3 font-semibold text-gray-600" title="Team made the tournament cut (2+ players)">Cut</th>
                                            {manualMode && <th className="py-2 px-3" />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamsToDisplay.map((team, idx) => {
                                            const prevTeam = teamsToDisplay[idx - 1];
                                            const showCutLine = !manualMode && idx > 0 && team.teamMadeCut === false && prevTeam?.teamMadeCut !== false;
                                            return (
                                            <React.Fragment key={team.teamId}>
                                                {showCutLine && (
                                                    <tr>
                                                        <td colSpan={manualMode ? 11 : 10} className="py-1 px-3 bg-gray-100 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-t-2 border-b-2 border-gray-300">
                                                            ✂ Team Cut Line
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr
                                                    className={`border-t cursor-pointer hover:bg-gray-50 ${team.overallWin ? 'bg-yellow-50' : team.teamMadeCut === false && !manualMode ? 'bg-gray-50 opacity-75' : ''}`}
                                                    onClick={() => setExpandedTeam(expandedTeam === team.teamId ? null : team.teamId)}
                                                >
                                                    <td className="py-2 px-3 font-bold text-gray-700">
                                                        {!manualMode && team.teamMadeCut === false
                                                            ? <span className="text-xs font-bold text-gray-400 bg-gray-200 px-1 py-0.5 rounded">CUT</span>
                                                            : team.finalPosition === 1
                                                                ? <Trophy className="w-4 h-4 text-yellow-500 inline" />
                                                                : team.finalPosition}
                                                    </td>
                                                    <td className={`py-2 px-3 font-medium ${!manualMode && team.teamMadeCut === false ? 'text-gray-400' : ''}`}>{team.teamName}</td>
                                                    <td className="py-2 px-3 text-center font-mono">{formatScore(team.totalScore)}</td>
                                                    <td className={`py-2 px-3 text-center font-mono text-xs ${team.dailyWinRounds.includes(1) ? 'bg-yellow-100 font-bold' : ''}`}>{formatScore(team.roundScores?.r1 as number)}</td>
                                                    <td className={`py-2 px-3 text-center font-mono text-xs ${team.dailyWinRounds.includes(2) ? 'bg-yellow-100 font-bold' : ''}`}>{formatScore(team.roundScores?.r2 as number)}</td>
                                                    <td className={`py-2 px-3 text-center font-mono text-xs ${!manualMode && team.teamMadeCut === false ? 'text-gray-300' : team.dailyWinRounds.includes(3) ? 'bg-yellow-100 font-bold' : ''}`}>{!manualMode && team.teamMadeCut === false ? '—' : formatScore(team.roundScores?.r3 as number)}</td>
                                                    <td className={`py-2 px-3 text-center font-mono text-xs ${!manualMode && team.teamMadeCut === false ? 'text-gray-300' : team.dailyWinRounds.includes(4) ? 'bg-yellow-100 font-bold' : ''}`}>{!manualMode && team.teamMadeCut === false ? '—' : formatScore(team.roundScores?.r4 as number)}</td>
                                                    <td className="py-2 px-3 text-center text-xs">{team.dailyWins}</td>
                                                    <td className="py-2 px-3 text-center text-xs">
                                                        {team.cutsEarned === 1
                                                            ? <span className="text-green-600 font-bold">✓</span>
                                                            : <span className="text-gray-300">✗</span>}
                                                    </td>
                                                    {manualMode && (
                                                        <td className="py-2 px-3">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); removeManualTeam(idx); }}
                                                                className="text-red-400 hover:text-red-600 text-xs"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    )}
                                                    <td className="py-2 px-3 text-gray-400">
                                                        {expandedTeam === team.teamId
                                                            ? <ChevronUp className="w-4 h-4" />
                                                            : <ChevronDown className="w-4 h-4" />}
                                                    </td>
                                                </tr>
                                                {expandedTeam === team.teamId && team.players.length > 0 && (
                                                    <tr className="border-t bg-gray-50">
                                                        <td colSpan={manualMode ? 11 : 10} className="px-4 py-2">
                                                            <table className="min-w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-gray-500">
                                                                        <th className="text-left py-1 pr-4">Player</th>
                                                                        <th className="text-center py-1 pr-4">Pos</th>
                                                                        <th className="text-center py-1 pr-4">Total</th>
                                                                        <th className="text-center py-1 pr-4">Cut</th>
                                                                        <th className="text-center py-1 pr-4">R1</th>
                                                                        <th className="text-center py-1 pr-4">R2</th>
                                                                        <th className="text-center py-1 pr-4">R3</th>
                                                                        <th className="text-center py-1">R4</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {team.players.map(p => (
                                                                        <tr key={p.playerId} className="border-t border-gray-200">
                                                                            <td className="py-1 pr-4">{p.name}</td>
                                                                            <td className="py-1 pr-4 text-center">{p.finalPosition ?? '—'}</td>
                                                                            <td className="py-1 pr-4 text-center font-mono">{p.totalToPar ?? '—'}</td>
                                                                            <td className="py-1 pr-4 text-center">
                                                                                {p.madeCut
                                                                                    ? <CheckCircle className="w-3 h-3 text-green-500 inline" />
                                                                                    : p.isWithdrawn
                                                                                        ? <span className="text-red-500">WD</span>
                                                                                        : <span className="text-gray-400">–</span>}
                                                                            </td>
                                                                            <td className="py-1 pr-4 text-center font-mono">{formatScore(p.roundScores?.r1 as number)}</td>
                                                                            <td className="py-1 pr-4 text-center font-mono">{formatScore(p.roundScores?.r2 as number)}</td>
                                                                            <td className="py-1 pr-4 text-center font-mono">{formatScore(p.roundScores?.r3 as number)}</td>
                                                                            <td className="py-1 text-center font-mono">{formatScore(p.roundScores?.r4 as number)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                            ); })}
                                    </tbody>
                                </table>
                            </div>

                            {manualMode && (
                                <button onClick={addManualTeam} className="mt-2 text-sm text-green-700 hover:text-green-900 font-medium">
                                    + Add Team
                                </button>
                            )}
                        </div>
                    )}

                    {/* Manual team fields (editable names/scores) */}
                    {manualMode && manualTeams.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-800 flex items-center">
                                <Edit className="w-4 h-4 mr-2" /> Edit Team Records
                            </h3>
                            {manualTeams.map((team, idx) => (
                                <div key={team.teamId} className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border rounded-lg text-sm">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs text-gray-500 mb-0.5">Team Name</label>
                                        <input
                                            value={team.teamName}
                                            onChange={e => updateManualTeam(idx, 'teamName', e.target.value)}
                                            className="w-full p-1.5 border rounded focus:ring-2 focus:ring-green-700"
                                            placeholder="Team Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">Final Pos</label>
                                        <input
                                            type="number"
                                            value={team.finalPosition}
                                            onChange={e => updateManualTeam(idx, 'finalPosition', parseInt(e.target.value) || 0)}
                                            className="w-full p-1.5 border rounded focus:ring-2 focus:ring-green-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">Total Score</label>
                                        <input
                                            type="number"
                                            value={team.totalScore ?? ''}
                                            onChange={e => updateManualTeam(idx, 'totalScore', e.target.value === '' ? null : parseInt(e.target.value))}
                                            className="w-full p-1.5 border rounded focus:ring-2 focus:ring-green-700"
                                            placeholder="e.g. -10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">Daily Wins</label>
                                        <input
                                            type="number"
                                            value={team.dailyWins}
                                            onChange={e => updateManualTeam(idx, 'dailyWins', parseInt(e.target.value) || 0)}
                                            className="w-full p-1.5 border rounded focus:ring-2 focus:ring-green-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">Cuts Earned</label>
                                        <input
                                            type="number"
                                            value={team.cutsEarned}
                                            onChange={e => updateManualTeam(idx, 'cutsEarned', parseInt(e.target.value) || 0)}
                                            className="w-full p-1.5 border rounded focus:ring-2 focus:ring-green-700"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tournament Winner Override */}
                    <div className="border rounded-lg p-4 bg-green-50">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                            PGA Tournament Winner
                            <span className="ml-2 text-xs text-gray-500 font-normal">(auto-filled from data if available)</span>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Winner Name</label>
                                <input
                                    type="text"
                                    value={winner.name}
                                    onChange={e => setWinner(w => ({ ...w, name: e.target.value }))}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    placeholder="Scottie Scheffler"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Score (to par)</label>
                                <input
                                    type="text"
                                    value={winner.totalToPar as string}
                                    onChange={e => setWinner(w => ({ ...w, totalToPar: e.target.value }))}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    placeholder="-11"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                                <input
                                    type="text"
                                    value={winner.country}
                                    onChange={e => setWinner(w => ({ ...w, country: e.target.value }))}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    placeholder="USA"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Save Error */}
                    {saveError && (
                        <div className="flex items-start p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            {saveError}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 pt-2 border-t border-gray-200">
                        <button onClick={onClose} className="btn-secondary px-4 py-2" disabled={saving}>
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !canSave}
                            className="btn-primary flex items-center px-5 py-2"
                        >
                            {saving
                                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                                : <><Save className="w-4 h-4 mr-2" /> Save Season Record</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalizeSeasonModal;
