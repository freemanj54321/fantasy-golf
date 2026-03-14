import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Edit, Trash2, RefreshCw, X, Save, XCircle, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../config/firebaseCollections';
import { createTeam } from '../services/teamService';
import { useYear } from '../contexts/YearContext';

interface TeamGroup {
  teamId: string;
  name: string;
  yearDocs: { year: number; docId: string }[];
}

const TeamManagementPage: React.FC = () => {
  const { year: contextYear } = useYear();
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamYear, setNewTeamYear] = useState(contextYear);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.MEZZTER_TEAMS));
      const groupMap = new Map<string, TeamGroup>();

      snapshot.docs.forEach(d => {
        const data = d.data();
        const tid = data.teamId as string;
        if (!tid) return;
        if (!groupMap.has(tid)) {
          groupMap.set(tid, { teamId: tid, name: data.name as string, yearDocs: [] });
        }
        const group = groupMap.get(tid)!;
        if (data.year) {
          group.yearDocs.push({ year: data.year as number, docId: d.id });
        }
      });

      const groups = Array.from(groupMap.values());
      groups.sort((a, b) => a.name.localeCompare(b.name));
      groups.forEach(g => g.yearDocs.sort((a, b) => b.year - a.year));

      setTeamGroups(groups);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !newTeamYear) return;
    setSaving(true);
    try {
      const docId = await createTeam({ name: newTeamName.trim(), teamId: '', year: newTeamYear, roster: [], logoUrl: '' });
      // Re-fetch to get the generated teamId
      await loadTeams();
      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamYear(contextYear);
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRename = async (teamId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const q = query(collection(db, COLLECTIONS.MEZZTER_TEAMS), where('teamId', '==', teamId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.update(d.ref, { name: editName.trim() }));
      await batch.commit();
      setTeamGroups(prev =>
        prev.map(g => g.teamId === teamId ? { ...g, name: editName.trim() } : g)
      );
      setEditingTeamId(null);
    } catch (error) {
      console.error('Error renaming team:', error);
      alert('Failed to rename team');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteYear = async (teamId: string, docId: string, year: number) => {
    if (!window.confirm(`Remove the ${year} entry for this team? The team will still exist in other years.`)) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTIONS.MEZZTER_TEAMS, docId));
      await batch.commit();
      setTeamGroups(prev =>
        prev
          .map(g =>
            g.teamId === teamId
              ? { ...g, yearDocs: g.yearDocs.filter(yd => yd.docId !== docId) }
              : g
          )
          .filter(g => g.yearDocs.length > 0)
      );
    } catch (error) {
      console.error('Error deleting year entry:', error);
      alert('Failed to remove year entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async (group: TeamGroup) => {
    const years = group.yearDocs.map(yd => yd.year).join(', ');
    const yearStr = years ? ` (years: ${years})` : '';
    if (!window.confirm(`Permanently delete "${group.name}"${yearStr}? All year entries will be removed. This cannot be undone.`)) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      group.yearDocs.forEach(yd => batch.delete(doc(db, COLLECTIONS.MEZZTER_TEAMS, yd.docId)));
      await batch.commit();
      setTeamGroups(prev => prev.filter(g => g.teamId !== group.teamId));
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team');
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-green-700">
        <div>
          <div className="mb-1">
            <Link to="/admin" className="text-green-300 hover:text-white text-sm">← Admin</Link>
          </div>
          <h1 className="page-title flex items-center mb-0">
            <Shield className="w-8 h-8 mr-3 text-yellow-400" />
            Team Management
          </h1>
          <p className="mt-2 text-green-100">
            View and manage teams across all seasons. Rename teams or remove them from individual years.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <button
            onClick={() => { setNewTeamYear(contextYear); setShowCreateModal(true); }}
            className="btn-primary flex items-center"
            disabled={loading || saving}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Team
          </button>
          <button
            onClick={loadTeams}
            className="btn-secondary flex items-center"
            disabled={loading || saving}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">
          All Teams
          {!loading && <span className="text-gray-400 font-normal text-lg ml-2">({teamGroups.length})</span>}
        </h2>

        {loading && (
          <div className="text-center py-12 text-gray-500">Loading teams...</div>
        )}

        {!loading && teamGroups.length === 0 && (
          <div className="text-center py-12 text-gray-400 italic">
            No teams found. Use the "New Team" button to create one.
          </div>
        )}

        {!loading && teamGroups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Team Name</th>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Years Active</th>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamGroups.map(group => (
                  <tr key={group.teamId} className="border-b hover:bg-gray-50 transition-colors">

                    {/* Team Name */}
                    <td className="py-4 px-4">
                      {editingTeamId === group.teamId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveRename(group.teamId);
                              if (e.key === 'Escape') setEditingTeamId(null);
                            }}
                            className="p-1 border rounded focus:ring-2 focus:ring-green-700 text-sm font-medium w-48"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(group.teamId)}
                            disabled={saving}
                            className="text-green-700 hover:text-green-900 disabled:opacity-50"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingTeamId(null)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-800">{group.name}</span>
                      )}
                    </td>

                    {/* Year Chips */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {group.yearDocs.map(yd => (
                          <span
                            key={yd.docId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full"
                          >
                            {yd.year}
                            <button
                              onClick={() => handleDeleteYear(group.teamId, yd.docId, yd.year)}
                              disabled={saving || editingTeamId !== null}
                              className="text-green-500 hover:text-red-600 transition-colors disabled:opacity-40"
                              title={`Remove ${yd.year} entry`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {group.yearDocs.length === 0 && (
                          <span className="text-xs text-gray-400 italic">No year entries</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-4">
                        {editingTeamId !== group.teamId && (
                          <button
                            onClick={() => { setEditingTeamId(group.teamId); setEditName(group.name); }}
                            disabled={saving || editingTeamId !== null}
                            className="flex items-center text-sm text-green-700 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Rename
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAll(group)}
                          disabled={saving || editingTeamId !== null}
                          className="flex items-center text-sm text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete All
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="card w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800">New Team</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full hover:bg-gray-200">
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTeam(); }}
                  placeholder="e.g. The Megs"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={newTeamYear}
                  onChange={e => setNewTeamYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={saving || !newTeamName.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagementPage;
