import React, { useState, useEffect } from 'react';
import { Team, Golfer } from '../types';
import { Shield, X, Edit, Trash2, PlusCircle } from 'lucide-react';
import useAdmin from '../hooks/useAdmin';
import { useYear } from '../contexts/YearContext';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';

interface TeamsPageProps {
  userRole?: string;
}

const unwrapValue = (val: any): any => {
  if (val && typeof val === 'object' && val.$numberInt) {
    return parseInt(val.$numberInt, 10);
  }
  return val;
};

const sanitizeGolfer = (golfer: any): Golfer => {
  if (!golfer) return golfer;
  return {
    ...golfer,
    rank: unwrapValue(golfer.rank),
    position: unwrapValue(golfer.position),
    topar: unwrapValue(golfer.topar),
    thru: unwrapValue(golfer.thru),
  };
};

const TeamsPage: React.FC<TeamsPageProps> = ({ userRole }) => {
  const { year } = useYear();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { isAdmin } = useAdmin();
  const maxTeams = 20;

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsCollectionRef = collection(db, "FantasyGolf-Teams");
        const querySnapshot = await getDocs(teamsCollectionRef);
        const teamsData = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            const rawRoster = data.roster || data.players || [];
            const roster = Array.isArray(rawRoster) ? rawRoster.map(sanitizeGolfer) : [];
            return {
              id: doc.id,
              ...data,
              roster
            } as Team;
          })
          .filter(team => team.year === year);
        setTeams(teamsData);
      } catch (error) {
        console.error("Error fetching teams: ", error);
      }
    };

    fetchTeams();
  }, [year]);

  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setIsEditModalOpen(true);
  };

  const handleOpenAddModal = () => {
    if (teams.length >= maxTeams) {
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleSaveChanges = async (updatedTeam: Team) => {
    if (!updatedTeam.id) return;

    try {
      const teamDocRef = doc(db, "FantasyGolf-Teams", updatedTeam.id);
      const updateData: Record<string, any> = {
        name: updatedTeam.name || '',
        roster: updatedTeam.roster || [],
        year: updatedTeam.year,
        logoUrl: updatedTeam.logoUrl || ''
      };

      if (updatedTeam.teamId) {
        updateData.teamId = updatedTeam.teamId;
      }

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(teamDocRef, updateData);

      const updatedTeams = teams.map(team =>
        team.id === updatedTeam.id ? updatedTeam : team
      );
      setTeams(updatedTeams);
      setIsEditModalOpen(false);
      setSelectedTeam(updatedTeam);
    } catch (error) {
      console.error("Error updating team: ", error);
    }
  };

  // Generate a unique team ID
  const generateTeamId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `team_${timestamp}_${random}`;
  };

  const handleAddTeam = async (newTeam: Omit<Team, 'id'>) => {
    try {
      const teamToSave = {
        ...newTeam,
        teamId: newTeam.teamId || generateTeamId(),
        roster: newTeam.roster || []
      };
      const docRef = await addDoc(collection(db, "FantasyGolf-Teams"), teamToSave);
      setTeams([...teams, { ...teamToSave, id: docRef.id }]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding team: ", error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (window.confirm("Are you sure you want to delete this team?")) {
      try {
        await deleteDoc(doc(db, "FantasyGolf-Teams", teamId));
        setTeams(teams.filter(team => team.id !== teamId));
        setSelectedTeam(null);
      } catch (error) {
        console.error("Error deleting team: ", error);
      }
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!isAdmin) return;
    const previousYear = year - 1;

    if (window.confirm(`Are you sure you want to copy all teams from ${previousYear} to ${year}? This will create new team entries with empty rosters.`)) {
      try {
        const teamsCollectionRef = collection(db, "FantasyGolf-Teams");
        const querySnapshot = await getDocs(teamsCollectionRef);
        const previousYearTeams = querySnapshot.docs
          .map(doc => doc.data() as Team)
          .filter(team => team.year === previousYear);

        if (previousYearTeams.length === 0) {
          alert(`No teams found for the year ${previousYear}.`);
          return;
        }

        const newTeamsAdded: Team[] = [];

        for (const team of previousYearTeams) {
          const teamToSave = {
            name: team.name,
            logoUrl: team.logoUrl || '',
            year: year,
            // Preserve the same teamId for cross-year continuity
            teamId: team.teamId || generateTeamId(),
            roster: []
          };

          const alreadyExists = teams.some(t => t.name.toLowerCase() === teamToSave.name.toLowerCase());

          if (!alreadyExists) {
            const docRef = await addDoc(collection(db, "FantasyGolf-Teams"), teamToSave);
            newTeamsAdded.push({ ...teamToSave, id: docRef.id } as Team);
          }
        }

        if (newTeamsAdded.length > 0) {
          setTeams([...teams, ...newTeamsAdded]);
          alert(`Successfully copied ${newTeamsAdded.length} team(s) to ${year}.`);
        } else {
          alert("No new teams were copied. They may already exist in this year.");
        }

      } catch (error) {
        console.error("Error copying teams: ", error);
        alert("An error occurred while copying teams.");
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="page-title">League Teams - {year}</h1>
        {isAdmin && (
          <div className="flex space-x-3">
            <button
              onClick={handleCopyFromPreviousYear}
              className="btn-secondary"
              title={`Copy teams from ${year - 1}`}
            >
              Copy from {year - 1}
            </button>
            <button
              onClick={handleOpenAddModal}
              className="btn-primary"
              disabled={teams.length >= maxTeams}
            >
              <PlusCircle className="h-5 w-5 mr-2" />Add Team
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map(team => (
          <div key={team.id} className="card transform hover:-translate-y-1 transition-transform duration-300 ease-in-out cursor-pointer" onClick={() => setSelectedTeam(team)}>
            <div className="flex items-center mb-4">
              <Shield className="h-8 w-8 text-green-800 mr-4" />
              <div>
                <h3 className="text-lg font-bold text-gray-800">{team.name}</h3>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Players:</h4>
              <ul className="space-y-1">
                {team.roster && team.roster.slice(0, 3).map(p => <li key={p.id} className="text-sm text-gray-700 truncate">{p.name}</li>)}
                {team.roster && team.roster.length > 3 && <li className="text-sm text-gray-500">+ {team.roster.length - 3} more</li>}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTeam(null)}>
          <div className="card max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-green-800">{selectedTeam.name}</h2>
              </div>
              <div className='flex items-center'>
                {isAdmin && (
                  <>
                    <button onClick={() => handleOpenEditModal(selectedTeam)} className="p-1 rounded-full hover:bg-gray-200 transition-colors ml-2"><Edit className="h-6 w-6 text-gray-600" /></button>
                    <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="p-1 rounded-full hover:bg-gray-200 transition-colors ml-2"><Trash2 className="h-6 w-6 text-red-600" /></button>
                  </>
                )}
                <button onClick={() => setSelectedTeam(null)} className="p-1 rounded-full hover:bg-gray-200 transition-colors"><X className="h-6 w-6 text-gray-600" /></button>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Roster</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thru</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedTeam.roster && selectedTeam.roster.map((player: Golfer) => (
                    <tr key={player.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{player.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{player.position}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{player.topar}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{player.thru}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingTeam && (
        <TeamModal
          team={editingTeam}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveChanges}
          year={year}
          modalTitle="Edit Team"
        />
      )}
      {isAddModalOpen && (
        <TeamModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddTeam}
          year={year}
          modalTitle="Add Team"
        />
      )}
    </div>
  );
};

interface TeamModalProps {
  team?: Team;
  onClose: () => void;
  onSave: (team: any) => void;
  year: number;
  modalTitle: string;
}

const TeamModal: React.FC<TeamModalProps> = ({ team, onClose, onSave, year, modalTitle }) => {
  const [name, setName] = useState(team?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const teamData = {
      name,
      year,
      roster: team?.roster || [],
      logoUrl: team?.logoUrl || '',
      teamId: team?.teamId || ''
    };
    if (team?.id) {
      onSave({ ...team, ...teamData });
    } else {
      onSave(teamData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="card w-full max-w-md p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">{modalTitle}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              id="teamName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamsPage;
