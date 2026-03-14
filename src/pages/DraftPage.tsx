import React, { useState, useMemo, useEffect } from 'react';
import { Team, Golfer, PLAYERS_PER_TEAM, DataSource } from '../types';
import { Search, CheckCircle, PlusCircle, Trophy, ArrowDown, ArrowUp, ToggleLeft, ToggleRight, AlertTriangle, Globe, ChevronLeft, ChevronRight, XCircle, User, RotateCcw, Trash2 } from 'lucide-react';
import { subscribeToTeams, addPlayerToTeam, removePlayerFromTeam, resetDraft, updateDraftOrders, fetchAllUniqueTeams, createTeam, deleteTeam } from '../services/teamService';
import { fetchAvailableGolfers } from '../services/rankingService';
import { useQuery } from '@tanstack/react-query';
import { useYear } from '../contexts/YearContext';
import useLeagueSettings from '../hooks/useLeagueSettings';
import { updateLeagueSettings } from '../services/leagueService';
import useAdmin from '../hooks/useAdmin';

// --- Presentational Component (The UI) ---

interface DraftBoardProps {
  teams: Team[];
  availableGolfers: Golfer[];
  dataSources?: DataSource[];
  onDraft: (teamId: string, player: Golfer) => void;
  onRelease?: (teamId: string, playerId: string) => void;
  onRemoveTeam?: (teamId: string) => void;
  onGolferClick: (golfer: Golfer) => void;
  onReset: () => void;
}

const ITEMS_PER_PAGE = 20;

const DraftBoardView: React.FC<DraftBoardProps> = ({ teams, availableGolfers, dataSources, onDraft, onRelease, onRemoveTeam, onGolferClick, onReset }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [bypassMode, setBypassMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Snake Draft Logic ---
  const totalDrafted = teams.reduce((acc, team) => acc + (team.roster ? team.roster.length : 0), 0);
  const totalSlots = teams.length * PLAYERS_PER_TEAM;
  const isDraftComplete = totalDrafted >= totalSlots && totalSlots > 0;

  // Rounds are 1-based for display, logic is 0-based
  const currentRoundIndex = Math.floor(totalDrafted / (teams.length || 1));
  const currentPickInRound = totalDrafted % (teams.length || 1);
  const roundNumber = currentRoundIndex + 1;

  // Snake Order: Odd rounds (1, 3) -> Ascending (0..19). Even rounds (2) -> Descending (19..0).
  const isSnakeReverse = roundNumber % 2 === 0;

  let activeTeamIndex = -1;
  if (!isDraftComplete && teams.length > 0) {
    activeTeamIndex = isSnakeReverse
      ? (teams.length - 1) - currentPickInRound
      : currentPickInRound;
  }

  const snakeActiveTeam = activeTeamIndex >= 0 ? teams[activeTeamIndex] : null;

  // --- View State ---
  // Allows viewing other teams' rosters without changing who is "on the clock"
  const [viewingTeamId, setViewingTeamId] = useState<string>('');

  // Auto-focus the snake active team when the turn changes (unless in bypass mode, we stick to selection)
  useEffect(() => {
    if (snakeActiveTeam && !bypassMode) {
      setViewingTeamId(snakeActiveTeam.id);
    }
  }, [snakeActiveTeam?.id, totalDrafted, bypassMode]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Determine effective target team for drafting
  const targetTeam = bypassMode
    ? teams.find(t => t.id === viewingTeamId)
    : snakeActiveTeam;

  // --- Filtering and Sorting ---
  const draftedPlayerIds = new Set(teams.flatMap(t => (t.roster || []).map(p => p.id)));

  const filteredGolfers = useMemo(() => {
    return availableGolfers
      .filter(g => !draftedPlayerIds.has(g.id) &&
        (g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.country?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => a.rank - b.rank); // Sort by OWGR (Ascending)
  }, [availableGolfers, draftedPlayerIds, searchQuery]);

  const totalPages = Math.ceil(filteredGolfers.length / ITEMS_PER_PAGE);

  const paginatedGolfers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGolfers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGolfers, currentPage]);

  const handleDraft = (player: Golfer) => {
    if (!targetTeam) return;
    // Prevent overfilling a team
    if ((targetTeam.roster || []).length >= PLAYERS_PER_TEAM) return;

    onDraft(targetTeam.id, player);
  };

  const handleRelease = (player: Golfer) => {
    const teamWithPlayer = teams.find(t => (t.roster || []).some(p => p.id === player.id));
    if (teamWithPlayer && onRelease) {
      if (window.confirm(`Remove ${player.name} from ${teamWithPlayer.name}?`)) {
        onRelease(teamWithPlayer.id, player.id);
      }
    }
  };

  // Determine which team is currently being viewed in the roster panel
  const viewedTeam = teams.find(t => t.id === viewingTeamId) || snakeActiveTeam;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 p-6">

      {/* Left Column: Draft Order & Teams */}
      <div className="lg:col-span-4 flex flex-col card overflow-hidden h-[600px] lg:h-auto lg:max-h-[calc(100vh-140px)] p-0">
        <div className="p-4 bg-gray-900 text-white border-b border-gray-800 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center">
            <h2 className="font-serif text-xl mr-2">Draft Order</h2>
            {isDraftComplete ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              !bypassMode && (
                <span className="text-xs font-sans bg-gray-700 px-2 py-1 rounded flex items-center">
                  {isSnakeReverse ? <ArrowUp className="h-3 w-3 mr-1 text-orange-400" /> : <ArrowDown className="h-3 w-3 mr-1 text-green-400" />}
                  Round {roundNumber}
                </span>
              )
            )}
          </div>

          <div className="flex space-x-2">
            {/* Reset Button */}
            <button
              onClick={onReset}
              className="flex items-center space-x-2 text-xs uppercase tracking-wider font-bold px-2 py-1 rounded transition-colors bg-red-800 text-white hover:bg-red-700"
              title="Reset Draft"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Bypass Toggle */}
            {!isDraftComplete && (
              <button
                onClick={() => setBypassMode(!bypassMode)}
                className={`flex items-center space-x-2 text-xs uppercase tracking-wider font-bold px-2 py-1 rounded transition-colors ${bypassMode ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                title="Manually select team to draft for"
              >
                <span>Bypass</span>
                {bypassMode ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Added scroll hiding classes: [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] */}
        <div className="overflow-y-auto flex-1 p-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {teams.map((team, index) => {
            const roster = team.roster || [];
            const isFull = roster.length >= PLAYERS_PER_TEAM;
            const isSnakeActive = snakeActiveTeam?.id === team.id;
            const isViewing = viewingTeamId === team.id;

            // Visual Active State:
            // In Bypass Mode: Active is the selected team (viewing).
            // In Normal Mode: Active is the snakeActiveTeam.
            const isVisuallyActive = bypassMode ? isViewing : isSnakeActive;

            // Calculate overall pick numbers for this team in a 3-round draft
            const picks = [
              index + 1,
              (teams.length * 2) - index,
              (teams.length * 2) + index + 1
            ];
            const nextPick = picks.find(p => p > totalDrafted);

            return (
              <div
                key={team.id}
                onClick={() => setViewingTeamId(team.id)}
                className={`group w-full text-left p-3 border-b border-gray-100 flex justify-between items-center transition-all cursor-pointer relative
                  ${isVisuallyActive ? (bypassMode ? 'bg-orange-50' : 'bg-yellow-50') : 'hover:bg-gray-50'}
                  ${isViewing && !isVisuallyActive ? 'bg-gray-50' : ''}
                `}
              >
                {/* Active Indicator Bar */}
                {isVisuallyActive && <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${bypassMode ? 'bg-orange-500' : 'bg-yellow-400'} animate-pulse`}></div>}
                {isViewing && !isVisuallyActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300"></div>}

                <div className="flex items-center space-x-3 overflow-hidden pl-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                     ${isVisuallyActive
                      ? (bypassMode ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-yellow-900')
                      : 'bg-gray-200 text-gray-600'}`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold truncate text-sm ${isVisuallyActive ? 'text-gray-900' : 'text-gray-700'}`}>{team.name}</p>
                    <p className="text-xs text-gray-500">
                      {isFull ? 'Roster Full' : isSnakeActive && !bypassMode ? 'ON THE CLOCK' : `Next Pick: #${nextPick || '-'}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {roster.map((_, i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-green-600"></div>
                  ))}
                  {Array.from({ length: Math.max(0, PLAYERS_PER_TEAM - roster.length) }).map((_, i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-gray-200"></div>
                  ))}
                  {onRemoveTeam && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Remove "${team.name}" from the draft? This will delete the team and all their picks.`)) {
                          onRemoveTeam(team.id);
                        }
                      }}
                      className="ml-1 p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove Team"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active Draft Area */}
      <div className="lg:col-span-8 flex flex-col min-h-[600px] space-y-4">

        {/* Status Banner */}
        <div className={`rounded-xl shadow-sm border p-6 flex justify-between items-center transition-colors duration-50 flex-shrink-0
          ${isDraftComplete
            ? 'bg-green-900 border-green-800 text-white'
            : bypassMode
              ? 'bg-orange-50 border-orange-300 text-gray-900'
              : 'bg-white border-yellow-400'}
        `}>
          {isDraftComplete ? (
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-full bg-opacity-20">
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold">Draft Complete</h2>
                <p className="text-green-200">All rosters are filled. Good luck in the tournament!</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between w-full">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="relative">
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow
                        ${bypassMode ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-yellow-900'}
                      `}>
                    {targetTeam?.name.substring(0, 1)}
                  </div>
                  {!bypassMode && (
                    <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                      LIVE
                    </div>
                  )}
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-widest font-bold ${bypassMode ? 'text-orange-700' : 'text-gray-500'}`}>
                    {bypassMode ? 'MANUAL DRAFT MODE' : `On The Clock • Pick ${totalDrafted + 1}`}
                  </p>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">
                    {targetTeam ? targetTeam.name : 'Select a Team'}
                  </h2>
                </div>
              </div>
              <div className="text-right hidden md:block">
                {bypassMode ? (
                  <div className="flex flex-col items-end text-orange-600">
                    <AlertTriangle className="h-8 w-8 mb-1" />
                    <span className="text-xs font-bold uppercase">Bypassing Order</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-gray-200 font-serif">{roundNumber}</div>
                    <div className="text-xs text-gray-400 uppercase">Current Round</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player Pool */}
        <div className="flex-1 card overflow-hidden flex flex-col min-h-[400px] p-0">

          {/* Toggle / Header */}
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex space-x-4 items-center">
              <h3 className="font-serif font-bold text-gray-800 text-lg">Available Golfers</h3>
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">{filteredGolfers.length} Found</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search all golfers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isDraftComplete}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-64 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isDraftComplete && (
              <div className="text-center py-12 text-gray-500">
                <p>Use the Team Manager or Dashboard to view final rosters.</p>
              </div>
            )}

            {!isDraftComplete && (
              <>
                {paginatedGolfers.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    No golfers found matching your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {paginatedGolfers.map(golfer => {
                      const isTeamFull = (targetTeam?.roster || []).length >= PLAYERS_PER_TEAM;
                      const canDraft = targetTeam && !isTeamFull;

                      return (
                        <button
                          key={golfer.id}
                          onClick={() => handleDraft(golfer)}
                          disabled={!canDraft}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all group text-left
                             ${canDraft
                              ? 'bg-white text-gray-800 border-gray-200 hover:border-green-500 hover:bg-green-50 hover:shadow-md hover:text-gray-800'
                              : 'bg-gray-50 text-gray-500 border-gray-100 opacity-60 cursor-not-allowed hover:bg-gray-50 hover:text-gray-500'
                            }
                          `}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex flex-col items-center justify-center bg-gray-100 rounded w-8 h-8 flex-shrink-0">
                              <span className="text-[10px] text-gray-400 uppercase font-bold leading-none">Rank</span>
                              <span className="text-sm font-bold text-gray-700 leading-none">{golfer.rank}</span>
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 group-hover:text-gray-900">{golfer.name}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{golfer.country}</span>
                                <span className="text-xs text-green-700 font-medium">{golfer.odds}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors
                                ${canDraft ? 'bg-gray-100 group-hover:bg-green-500' : 'bg-gray-200'}
                            `}>
                            <PlusCircle className={`h-5 w-5 ${canDraft ? 'text-gray-400 group-hover:text-white' : 'text-gray-300'}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Info with Grounding Sources & Pagination */}
          <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col space-y-2 flex-shrink-0">

            {/* Pagination Controls */}
            {!isDraftComplete && filteredGolfers.length > 0 && (
              <div className="flex justify-between items-center pb-2 border-b border-gray-200 mb-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent text-gray-600"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent text-gray-600"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Viewing Roster: <span className="font-bold text-gray-700">{viewedTeam?.name}</span></span>
            </div>
            {dataSources && dataSources.length > 0 && (
              <div className="text-[10px] text-gray-400 pt-1">
                <div className="flex items-center mb-1">
                  <Globe className="h-3 w-3 mr-1" />
                  <span className="font-bold">Data Sourced from {dataSources[0].name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Team Roster Preview (Bottom Panel) */}
        <div className="card flex-shrink-0">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Current Roster: <span className="text-gray-900">{viewedTeam?.name}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(viewedTeam?.roster || []).map(golfer => (
              <div key={golfer.id} onClick={() => onGolferClick(golfer)} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 cursor-pointer hover:bg-gray-100 group">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center text-xs font-bold border border-gray-200 flex-shrink-0">
                    #{golfer.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{golfer.name}</p>
                    <p className="text-[10px] text-gray-500">{golfer.country}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRelease(golfer);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                  title="Remove Player"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, PLAYERS_PER_TEAM - (viewedTeam?.roster?.length || 0)) }).map((_, i) => (
              <div key={i} className="flex items-center justify-center p-3 border border-dashed border-gray-300 rounded text-xs text-gray-400 bg-gray-50">
                <User className="h-3 w-3 mr-1.5 opacity-50" />
                Empty Slot
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Add Team Modal ---

interface AddTeamModalProps {
  existingYearTeamIds: Set<string>;
  year: number;
  nextDraftOrder: number;
  onClose: () => void;
  onAdded: () => void;
}

const AddTeamModal: React.FC<AddTeamModalProps> = ({ existingYearTeamIds, year, nextDraftOrder, onClose, onAdded }) => {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchAllUniqueTeams()
      .then(teams => {
        setAllTeams(teams.filter(t => !existingYearTeamIds.has(t.teamId)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAddExisting = async (team: Team) => {
    setAdding(true);
    try {
      await createTeam({ name: team.name, teamId: team.teamId, year, roster: [], logoUrl: team.logoUrl || '', draftOrder: nextDraftOrder });
      onAdded();
    } catch (e) {
      console.error('Failed to add team:', e);
      alert('Failed to add team');
    } finally {
      setAdding(false);
    }
  };

  const handleAddNew = async () => {
    if (!newTeamName.trim()) return;
    setAdding(true);
    try {
      await createTeam({ name: newTeamName.trim(), teamId: '', year, roster: [], logoUrl: '', draftOrder: nextDraftOrder });
      onAdded();
    } catch (e) {
      console.error('Failed to create team:', e);
      alert('Failed to create team');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="card w-full max-w-md p-6 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Add Team to Draft</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <XCircle className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading teams...</div>
        ) : (
          <>
            {allTeams.length > 0 && (
              <>
                <p className="text-sm text-gray-600 mb-2">Select an existing team:</p>
                <div className="overflow-y-auto flex-1 mb-4 border rounded divide-y">
                  {allTeams.map(team => (
                    <button
                      key={team.teamId}
                      onClick={() => handleAddExisting(team)}
                      disabled={adding}
                      className="w-full text-left px-4 py-3 hover:bg-green-50 hover:text-green-900 transition-colors disabled:opacity-50"
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className={allTeams.length > 0 ? 'border-t pt-4' : ''}>
              <p className="text-sm text-gray-600 mb-2">Or create a new team:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="New team name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }}
                />
                <button
                  onClick={handleAddNew}
                  disabled={adding || !newTeamName.trim()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  Add New
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Pre-Draft Configuration View ---
interface PreDraftViewProps {
  teams: Team[];
  onSaveOrder: (teams: Team[]) => Promise<void>;
  onStartDraft: () => Promise<void>;
  isAdmin: boolean;
  onAddTeam?: () => void;
  onRemoveTeam?: (teamId: string) => Promise<void>;
}

const PreDraftView: React.FC<PreDraftViewProps> = ({ teams, onSaveOrder, onStartDraft, isAdmin, onAddTeam, onRemoveTeam }) => {
  const [localTeams, setLocalTeams] = useState<Team[]>(teams);
  const [draggedTeamIndex, setDraggedTeamIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Sync when props change initially or after a remote save
  useEffect(() => {
    setLocalTeams(teams);
  }, [teams]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedTeamIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTeamIndex === null || draggedTeamIndex === index) return;

    const newTeams = [...localTeams];
    const draggedTeam = newTeams[draggedTeamIndex];
    newTeams.splice(draggedTeamIndex, 1);
    newTeams.splice(index, 0, draggedTeam);

    setDraggedTeamIndex(index);
    setLocalTeams(newTeams);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedTeamIndex(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const moveTeamUp = (index: number) => {
    if (index === 0) return;
    const newTeams = [...localTeams];
    const team = newTeams[index];
    newTeams.splice(index, 1);
    newTeams.splice(index - 1, 0, team);
    setLocalTeams(newTeams);
  };

  const handlePositionCommit = (fromIndex: number, value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const targetIndex = Math.max(0, Math.min(localTeams.length - 1, parsed - 1));
    if (targetIndex === fromIndex) return;
    const newTeams = [...localTeams];
    const [team] = newTeams.splice(fromIndex, 1);
    newTeams.splice(targetIndex, 0, team);
    setLocalTeams(newTeams);
  };

  const moveTeamDown = (index: number) => {
    if (index === localTeams.length - 1) return;
    const newTeams = [...localTeams];
    const team = newTeams[index];
    newTeams.splice(index, 1);
    newTeams.splice(index + 1, 0, team);
    setLocalTeams(newTeams);
  };

  const handleSaveDraftOrder = async () => {
    setIsSaving(true);
    try {
      await onSaveOrder(localTeams);
    } catch (e) {
      console.error("Failed to save draft order:", e);
      alert("Failed to save draft order");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="page-title">Draft Preparation</h1>
        <p className="text-green-100 text-sm">The draft has not started yet. Admins can configure the team order below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Draft Order Management</h2>
              {isAdmin && (
                <div className="flex gap-2">
                  {onAddTeam && (
                    <button
                      onClick={onAddTeam}
                      className="btn-primary py-1 text-sm flex items-center"
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Team
                    </button>
                  )}
                  <button
                    onClick={handleSaveDraftOrder}
                    className="btn-secondary py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800"
                    disabled={isSaving || localTeams.length === 0}
                  >
                    {isSaving ? 'Saving...' : 'Save Current Order'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-600 mb-6 text-sm">Drag and drop teams, use the arrows, or click a position number to reorder.</p>

            <div className="flex flex-col space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {localTeams.length === 0 ? (
                <p className="text-gray-500 italic p-4 text-center border rounded">No teams have joined the league yet.</p>
              ) : (
                localTeams.map((team, index) => (
                  <div
                    key={team.id}
                    draggable={isAdmin}
                    onDragStart={(e) => isAdmin && handleDragStart(e, index)}
                    onDragOver={(e) => isAdmin && handleDragOver(e, index)}
                    onDragEnd={isAdmin ? handleDragEnd : undefined}
                    className={`flex items-center justify-between p-3 bg-white border rounded shadow-sm ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-green-400' : ''} transition-colors ${draggedTeamIndex === index ? 'border-dashed border-green-500 opacity-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center space-x-3">
                      {isAdmin ? (
                        <input
                          type="number"
                          min={1}
                          max={localTeams.length}
                          value={editingIndex === index ? editValue : index + 1}
                          onFocus={() => { setEditingIndex(index); setEditValue(String(index + 1)); }}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => { handlePositionCommit(editingIndex ?? index, editValue); setEditingIndex(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.currentTarget.blur(); }
                            if (e.key === 'Escape') { setEditingIndex(null); e.currentTarget.blur(); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.stopPropagation()}
                          className="bg-gray-100 text-gray-600 text-center py-1 rounded-sm text-xs font-bold w-10 shrink-0 cursor-text focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="Click to change position"
                        />
                      ) : (
                        <span className="bg-gray-100 text-gray-500 px-2 flex justify-center items-center py-1 rounded-sm text-xs font-bold w-8 shrink-0 select-none">
                          {index + 1}
                        </span>
                      )}
                      <span className="font-medium text-gray-800 select-none">{team.name}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col cursor-pointer bg-gray-50 rounded">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveTeamUp(index); }}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-green-600 disabled:opacity-30 disabled:hover:text-gray-400 p-1"
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveTeamDown(index); }}
                            disabled={index === localTeams.length - 1}
                            className="text-gray-400 hover:text-green-600 disabled:opacity-30 disabled:hover:text-gray-400 p-1"
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        {onRemoveTeam && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Remove "${team.name}" from the draft?`)) {
                                onRemoveTeam(team.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove Team"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="card sticky top-6 text-center">
            <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Go?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Once all teams have joined and the draft order is finalized, click below to open the draft room.
            </p>

            {isAdmin ? (
              <button
                onClick={onStartDraft}
                className="btn-primary w-full py-3 text-lg font-bold shadow-md transform transition hover:scale-105"
                disabled={localTeams.length === 0}
              >
                Start Draft
              </button>
            ) : (
              <div className="bg-gray-100 text-gray-600 p-3 rounded font-medium text-sm">
                Waiting for League Admin to start the draft...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Container Component (The Logic) ---

const MASTERS_TOURN_ID = '014';

const DraftPage: React.FC = () => {
  const { year } = useYear();
  const { settings, loading: settingsLoading } = useLeagueSettings();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);

  const existingYearTeamIds = useMemo(
    () => new Set(teams.map(t => t.teamId).filter(Boolean) as string[]),
    [teams]
  );

  const { data: availableGolfers = [], isLoading: loadingGolfers } = useQuery({
    queryKey: ['availableGolfers', year, MASTERS_TOURN_ID],
    queryFn: () => fetchAvailableGolfers(year, MASTERS_TOURN_ID),
    enabled: !!year && year !== 0,
  });

  useEffect(() => {
    // 1. Subscribe to teams (Real-time)
    const unsubscribe = subscribeToTeams((updatedTeams) => {
      // Ensure each team has a roster array
      const teamsWithRoster = updatedTeams.map(t => ({
        ...t,
        roster: t.roster || []
      }));
      setTeams(teamsWithRoster);
    }, year);

    return () => unsubscribe();
  }, [year]);

  const handleDraft = async (teamId: string, player: Golfer) => {
    try {
      await addPlayerToTeam(teamId, player);
    } catch (error) {
      console.error("Failed to draft player:", error);
      alert("Failed to draft player. Please try again.");
    }
  };

  const handleRelease = async (teamId: string, playerId: string) => {
    try {
      // Find the player object
      const team = teams.find(t => t.id === teamId);
      const player = team?.roster.find(p => p.id === playerId);
      if (player) {
        await removePlayerFromTeam(teamId, player);
      }
    } catch (error) {
      console.error("Failed to release player:", error);
      alert("Failed to release player. Please try again.");
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId);
    } catch (error) {
      console.error("Failed to remove team:", error);
      alert("Failed to remove team. Please try again.");
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to RESET the draft? All rosters will be cleared.")) {
      try {
        await resetDraft(year);
        // Add resetting league settings draftStatus to 'pre-draft'
        await updateLeagueSettings(year, { draftStatus: 'pre-draft' });
      } catch (error) {
        console.error("Failed to reset draft:", error);
        alert("Failed to reset draft. Please try again.");
      }
    }
  };

  const handleGolferClick = (golfer: Golfer) => {
    console.log("Golfer clicked:", golfer);
    // Potential future feature: Show Golfer Details Modal
  };

  const handleSaveOrder = async (reorderedTeams: Team[]) => {
    const updates = reorderedTeams.map((team, index) => ({
      id: team.id,
      draftOrder: index
    }));
    await updateDraftOrders(updates);
  };

  const handleStartDraft = async () => {
    if (window.confirm("Are you sure you want to START the draft? This will lock the draft order.")) {
      await updateLeagueSettings(year, { draftStatus: 'in-progress' });
    }
  }

  if (loadingGolfers || settingsLoading || adminLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-800"></div>
      </div>
    )
  }

  if (settings.draftStatus === 'pre-draft') {
    return (
      <>
        <PreDraftView
          teams={teams}
          onSaveOrder={handleSaveOrder}
          onStartDraft={handleStartDraft}
          isAdmin={isAdmin}
          onAddTeam={isAdmin ? () => setIsAddTeamOpen(true) : undefined}
          onRemoveTeam={isAdmin ? handleRemoveTeam : undefined}
        />
        {isAddTeamOpen && (
          <AddTeamModal
            existingYearTeamIds={existingYearTeamIds}
            year={year}
            nextDraftOrder={teams.length}
            onClose={() => setIsAddTeamOpen(false)}
            onAdded={() => setIsAddTeamOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <DraftBoardView
      teams={teams}
      availableGolfers={availableGolfers}
      dataSources={[{ name: "Tournament Field (Firestore)" }]}
      onDraft={handleDraft}
      onRelease={handleRelease}
      onReset={handleReset}
      onGolferClick={handleGolferClick}
      onRemoveTeam={isAdmin ? handleRemoveTeam : undefined}
    />
  );
};

export default DraftPage;
