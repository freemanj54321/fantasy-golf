import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Star, Users, Pencil, X } from 'lucide-react';
import { SeasonRecord } from '../types';
import { fetchAllSeasonRecords } from '../services/seasonRecordsService';
import useAdmin from '../hooks/useAdmin';
import FinalizeSeasonModal from '../components/FinalizeSeasonModal';
import bgImage from '../assets/ChampionsLockerRoom.jpg';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatScore = (score: number | string | null | undefined): string => {
    if (score === null || score === undefined || score === '') return '—';
    if (typeof score === 'string') {
        const s = score.toUpperCase();
        if (s === 'E' || s === 'EVEN') return 'E';
        return score;
    }
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
};

const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ChampionDetailModal: React.FC<{ record: SeasonRecord; onClose: () => void }> = ({ record, onClose }) => {
    const champ = record.teams.find(t => t.overallWin);
    if (!champ) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative bg-green-900/95 backdrop-blur-md rounded-2xl shadow-2xl text-white w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-green-300 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-yellow-400 p-2 rounded-full">
                            <Trophy className="w-5 h-5 text-green-900" />
                        </div>
                        <span className="text-yellow-400 text-sm font-bold uppercase tracking-wider">{record.year} Champion</span>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white">{champ.teamName}</h2>
                    <p className="text-green-300 text-sm mt-1">{record.tournamentName}</p>
                </div>

                {/* Score summary */}
                <div className="p-6 border-b border-white/10">
                    <div className="grid grid-cols-5 gap-2 text-center">
                        {([
                            { label: 'Total', value: formatScore(champ.totalScore) },
                            { label: 'R1', value: formatScore(champ.roundScores?.r1 as number) },
                            { label: 'R2', value: formatScore(champ.roundScores?.r2 as number) },
                            { label: 'R3', value: formatScore(champ.roundScores?.r3 as number) },
                            { label: 'R4', value: formatScore(champ.roundScores?.r4 as number) },
                        ] as { label: string; value: string }[]).map(({ label, value }) => (
                            <div key={label} className="bg-white/10 rounded-lg py-2 px-1">
                                <p className="text-green-300 text-xs uppercase mb-1">{label}</p>
                                <p className="text-white font-mono font-bold">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Players */}
                {champ.players.length > 0 && (
                    <div className="p-6">
                        <h3 className="text-sm font-semibold text-green-300 uppercase tracking-wider mb-3">Roster</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-green-400 text-xs">
                                    <th className="text-left py-1 pr-2">Player</th>
                                    <th className="text-center py-1">Pos</th>
                                    <th className="text-center py-1">Total</th>
                                    <th className="text-center py-1">R1</th>
                                    <th className="text-center py-1">R2</th>
                                    <th className="text-center py-1">R3</th>
                                    <th className="text-center py-1">R4</th>
                                </tr>
                            </thead>
                            <tbody>
                                {champ.players.map(p => (
                                    <tr
                                        key={p.playerId}
                                        className={`border-t border-white/10 ${!p.madeCut ? 'opacity-50' : ''}`}
                                    >
                                        <td className="py-2 pr-2 font-medium">{p.name}</td>
                                        <td className="py-2 text-center text-green-300 text-xs">{p.finalPosition ?? '—'}</td>
                                        <td className="py-2 text-center font-mono">{formatScore(p.totalToPar)}</td>
                                        <td className="py-2 text-center font-mono text-xs">{formatScore(p.roundScores?.r1 as number)}</td>
                                        <td className="py-2 text-center font-mono text-xs">{formatScore(p.roundScores?.r2 as number)}</td>
                                        <td className="py-2 text-center font-mono text-xs">{!p.madeCut ? '—' : formatScore(p.roundScores?.r3 as number)}</td>
                                        <td className="py-2 text-center font-mono text-xs">{!p.madeCut ? '—' : formatScore(p.roundScores?.r4 as number)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const ChampionsSection: React.FC<{ records: SeasonRecord[] }> = ({ records }) => {
    const [selectedRecord, setSelectedRecord] = useState<SeasonRecord | null>(null);

    if (records.length === 0) return null;
    return (
        <section className="mb-10">
            <div className="bg-green-900/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl text-white">
                <div className="flex items-center mb-6">
                    <div className="bg-yellow-400 p-2 rounded-full mr-3">
                        <Trophy className="w-6 h-6 text-green-900" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-yellow-400">Fantasy Golf Champions</h2>
                        <p className="text-green-300 text-sm">League winners across all seasons</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {records.map((record, i) => {
                        const champ = record.teams.find(t => t.overallWin);
                        return (
                            <button
                                key={record.year}
                                onClick={() => setSelectedRecord(record)}
                                className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border-2 transition-all hover:bg-white/20 hover:scale-105 cursor-pointer ${i === 0 ? 'border-yellow-400' : 'border-white/20 hover:border-white/50'}`}
                            >
                                {i === 0 && (
                                    <div className="flex justify-center mb-2">
                                        <span className="bg-yellow-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Latest</span>
                                    </div>
                                )}
                                <div className="text-2xl font-serif font-bold text-yellow-400 mb-1">{record.year}</div>
                                <Trophy className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
                                <p className="font-semibold text-white text-sm leading-tight">{champ?.teamName ?? 'Unknown'}</p>
                                <p className="text-green-300 font-mono text-xs mt-1">{formatScore(champ?.totalScore ?? null)}</p>
                                <p className="text-green-400 text-xs mt-1">{record.tournamentName}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedRecord && (
                <ChampionDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
            )}
        </section>
    );
};

// ─── All-Time Standings ───────────────────────────────────────────────────────

interface AllTimeRow {
    teamId: string;
    teamName: string;
    yearsPlayed: number;
    titles: number;
    dailyWins: number;
    totalCuts: number;
    bestPosition: number;
}

const TeamHistoryModal: React.FC<{ row: AllTimeRow; records: SeasonRecord[]; onClose: () => void }> = ({ row, records, onClose }) => {
    const appearances = useMemo(() =>
        records
            .map(record => ({ record, team: record.teams.find(t => t.teamId === row.teamId) }))
            .filter((a): a is { record: SeasonRecord; team: NonNullable<typeof a.team> } => !!a.team)
            .sort((a, b) => b.record.year - a.record.year),
        [records, row.teamId]
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative bg-green-900/95 backdrop-blur-md rounded-2xl shadow-2xl text-white w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <button onClick={onClose} className="absolute top-4 right-4 text-green-300 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-700 p-2 rounded-full">
                            <Users className="w-5 h-5 text-green-300" />
                        </div>
                        <span className="text-green-300 text-sm font-bold uppercase tracking-wider">Tournament History</span>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white">{row.teamName}</h2>

                    {/* Career summary pills */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-gray-200">{row.yearsPlayed} {row.yearsPlayed === 1 ? 'Season' : 'Seasons'}</span>
                        {row.titles > 0 && (
                            <span className="bg-yellow-400/20 border border-yellow-400/40 rounded-full px-3 py-1 text-xs text-yellow-300 flex items-center gap-1">
                                <Trophy className="w-3 h-3" /> {row.titles} {row.titles === 1 ? 'Title' : 'Titles'}
                            </span>
                        )}
                        <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-gray-200">{row.dailyWins} Daily {row.dailyWins === 1 ? 'Win' : 'Wins'}</span>
                        <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-gray-200">Best: {row.bestPosition === 1 ? '1st' : ordinal(row.bestPosition)}</span>
                    </div>
                </div>

                {/* Season-by-season */}
                <div className="divide-y divide-white/10">
                    {appearances.map(({ record, team }) => (
                        <div key={record.year} className="p-6">
                            {/* Season header */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-serif font-bold text-yellow-400">{record.year}</span>
                                        {team.overallWin && (
                                            <span className="bg-yellow-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
                                                <Trophy className="w-3 h-3" /> Champion
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-green-300 text-xs mt-0.5">{record.tournamentName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-bold font-mono">{formatScore(team.totalScore)}</p>
                                    <p className="text-green-300 text-xs">{ordinal(team.finalPosition)} place</p>
                                </div>
                            </div>

                            {/* Round scores */}
                            <div className="grid grid-cols-5 gap-1.5 mb-4">
                                {([
                                    { label: 'Total', value: formatScore(team.totalScore) },
                                    { label: 'R1', value: formatScore(team.roundScores?.r1 as number) },
                                    { label: 'R2', value: formatScore(team.roundScores?.r2 as number) },
                                    { label: 'R3', value: formatScore(team.roundScores?.r3 as number) },
                                    { label: 'R4', value: formatScore(team.roundScores?.r4 as number) },
                                ] as { label: string; value: string }[]).map(({ label, value }) => (
                                    <div key={label} className="bg-white/10 rounded-lg py-1.5 px-1 text-center">
                                        <p className="text-green-400 text-xs uppercase mb-0.5">{label}</p>
                                        <p className="text-white font-mono text-sm font-bold">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Players */}
                            {team.players.length > 0 && (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-green-400">
                                            <th className="text-left py-1 pr-2">Player</th>
                                            <th className="text-center py-1">Pos</th>
                                            <th className="text-center py-1">Total</th>
                                            <th className="text-center py-1">R1</th>
                                            <th className="text-center py-1">R2</th>
                                            <th className="text-center py-1">R3</th>
                                            <th className="text-center py-1">R4</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {team.players.map(p => (
                                            <tr key={p.playerId} className={`border-t border-white/10 ${!p.madeCut ? 'opacity-50' : ''}`}>
                                                <td className="py-1.5 pr-2 font-medium text-white">{p.name}</td>
                                                <td className="py-1.5 text-center text-green-300">{p.finalPosition ?? '—'}</td>
                                                <td className="py-1.5 text-center font-mono">{formatScore(p.totalToPar)}</td>
                                                <td className="py-1.5 text-center font-mono">{formatScore(p.roundScores?.r1 as number)}</td>
                                                <td className="py-1.5 text-center font-mono">{formatScore(p.roundScores?.r2 as number)}</td>
                                                <td className="py-1.5 text-center font-mono">{!p.madeCut ? '—' : formatScore(p.roundScores?.r3 as number)}</td>
                                                <td className="py-1.5 text-center font-mono">{!p.madeCut ? '—' : formatScore(p.roundScores?.r4 as number)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* Daily wins badge */}
                            {team.dailyWins > 0 && (
                                <p className="mt-2 text-xs text-yellow-300">
                                    Daily win{team.dailyWins > 1 ? 's' : ''}: {team.dailyWinRounds.map(r => `R${r}`).join(', ')}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AllTimeStandingsSection: React.FC<{ records: SeasonRecord[] }> = ({ records }) => {
    const [selectedRow, setSelectedRow] = useState<AllTimeRow | null>(null);

    const rows = useMemo<AllTimeRow[]>(() => {
        const map = new Map<string, AllTimeRow>();

        for (const record of records) {
            for (const team of record.teams) {
                const existing = map.get(team.teamId);
                if (!existing) {
                    map.set(team.teamId, {
                        teamId: team.teamId,
                        teamName: team.teamName,
                        yearsPlayed: 1,
                        titles: team.overallWin ? 1 : 0,
                        dailyWins: team.dailyWins,
                        totalCuts: team.cutsEarned,
                        bestPosition: team.finalPosition,
                    });
                } else {
                    existing.yearsPlayed++;
                    existing.titles += team.overallWin ? 1 : 0;
                    existing.dailyWins += team.dailyWins;
                    existing.totalCuts += team.cutsEarned;
                    if (team.finalPosition < existing.bestPosition) existing.bestPosition = team.finalPosition;
                    // Update name to most recent
                    existing.teamName = team.teamName;
                }
            }
        }

        return Array.from(map.values()).sort((a, b) => {
            if (b.titles !== a.titles) return b.titles - a.titles;
            return a.bestPosition - b.bestPosition;
        });
    }, [records]);

    if (rows.length === 0) return null;

    return (
        <section className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2 text-green-300" />
                Fantasy Golf Performance
            </h2>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl shadow-xl overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-white/10">
                        <tr>
                            <th className="text-left py-3 px-4 font-semibold text-gray-200">#</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-200">Team</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-200">Years</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-200">
                                <Trophy className="w-4 h-4 text-yellow-400 inline" /> Titles
                            </th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-200">Daily Wins</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-200" title="Seasons where team had 2+ players make the cut">Team Cuts</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-200">Best Pos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr
                                key={row.teamId}
                                onClick={() => setSelectedRow(row)}
                                className={`border-t border-white/10 cursor-pointer transition-colors hover:bg-white/10 ${row.titles > 0 ? 'bg-yellow-400/20 hover:bg-yellow-400/30' : ''}`}
                            >
                                <td className="py-3 px-4 font-bold text-gray-300">{idx + 1}</td>
                                <td className="py-3 px-4 font-medium text-white">{row.teamName}</td>
                                <td className="py-3 px-4 text-center text-gray-200">{row.yearsPlayed}</td>
                                <td className="py-3 px-4 text-center font-bold text-yellow-400">{row.titles}</td>
                                <td className="py-3 px-4 text-center text-gray-200">{row.dailyWins}</td>
                                <td className="py-3 px-4 text-center text-gray-200">{row.totalCuts}</td>
                                <td className="py-3 px-4 text-center text-gray-200">
                                    {row.bestPosition === 1
                                        ? <Trophy className="w-4 h-4 text-yellow-400 inline" />
                                        : ordinal(row.bestPosition)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedRow && (
                <TeamHistoryModal row={selectedRow} records={records} onClose={() => setSelectedRow(null)} />
            )}
        </section>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ChampionsLockerRoomPage: React.FC = () => {
    const { isAdmin } = useAdmin();
    const [records, setRecords] = useState<SeasonRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<SeasonRecord | null>(null);

    // Make App-content transparent so the fixed background image shows through
    useEffect(() => {
        const appContent = document.querySelector('.App-content') as HTMLElement | null;
        if (appContent) {
            const prev = appContent.style.backgroundColor;
            appContent.style.backgroundColor = 'transparent';
            return () => { appContent.style.backgroundColor = prev; };
        }
    }, []);

    useEffect(() => {
        fetchAllSeasonRecords()
            .then(setRecords)
            .finally(() => setLoading(false));
    }, []);

    const handleSaved = (record: SeasonRecord) => {
        setRecords(prev => {
            const existing = prev.findIndex(r => r.year === record.year);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = record;
                return updated.sort((a, b) => b.year - a.year);
            }
            return [record, ...prev].sort((a, b) => b.year - a.year);
        });
    };

    return (
        <>
            {/* Fixed full-viewport background — behind header and footer */}
            <div
                className="fixed inset-0 bg-cover bg-center -z-10"
                style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div className="fixed inset-0 bg-black/60 -z-10" />

            <div className="container mx-auto px-4 py-8 max-w-5xl">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-green-700">
                        <div>
                            <h1 className="page-title flex items-center mb-0">
                                <Trophy className="w-8 h-8 mr-3 text-yellow-400" />
                                Champions Locker Room
                            </h1>
                            <p className="mt-2 text-green-100">Historical results, standings, and records across all Fantasy Golf seasons.</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => { setEditingRecord(null); setShowFinalizeModal(true); }}
                                className="btn-primary flex items-center mt-4 md:mt-0"
                            >
                                <Star className="w-4 h-4 mr-2" />
                                Finalize Season
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-800" />
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-16 text-gray-300">
                            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                            <p className="text-xl font-medium mb-2">No season records yet.</p>
                            <p className="text-sm">
                                {isAdmin
                                    ? 'Use the "Finalize Season" button above to compute and save a season\'s results.'
                                    : 'Season records will appear here once an admin finalizes them.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <ChampionsSection records={records} />
                            <AllTimeStandingsSection records={records} />

                            {/* Admin: Edit existing records */}
                            {isAdmin && (
                                <section className="mt-4 border-t border-white/20 pt-6">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Admin — Edit Season Records</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {records.map(r => (
                                            <button
                                                key={r.year}
                                                onClick={() => { setEditingRecord(r); setShowFinalizeModal(true); }}
                                                className="flex items-center text-sm text-green-300 hover:text-white border border-green-600 rounded-lg px-3 py-1.5 hover:bg-green-800/50 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                                Edit {r.year}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {showFinalizeModal && (
                        <FinalizeSeasonModal
                            onClose={() => { setShowFinalizeModal(false); setEditingRecord(null); }}
                            onSaved={handleSaved}
                            existingRecord={editingRecord}
                        />
                    )}
            </div>
        </>
    );
};

export default ChampionsLockerRoomPage;
