import React from 'react';
import { Team, Golfer } from '../types';
import { Edit3 } from 'lucide-react';

interface TeamCardProps {
  team: Team;
  onEdit: (team: Team) => void;
  onGolferClick: (golfer: Golfer) => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onEdit, onGolferClick }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-in-out">
      <div className="p-4 relative">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden mr-4 border-2 border-gray-200 dark:border-gray-600">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={`${team.name} logo`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-green-800 flex items-center justify-center text-white font-bold text-lg">
                {team.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{team.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{team.ownerEmail}</p>
          </div>
        </div>

        <button
          onClick={() => onEdit(team)}
          className="absolute top-2 right-2 p-2 text-gray-500 hover:text-green-600 dark:hover:text-green-400 rounded-full transition-colors"
          aria-label="Edit Team"
        >
          <Edit3 size={18} />
        </button>

        <div>
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm">Roster</h4>
          {team.roster && team.roster.length > 0 ? (
            <ul className="space-y-2">
              {team.roster.map((golfer, index) => {
                const toparStr = golfer.topar != null ? golfer.topar.toString() : '';
                const isUnderPar = toparStr.startsWith('-');
                const isOverPar = !isUnderPar && toparStr !== 'E' && toparStr !== '0' && toparStr !== '';

                return (
                  <li
                    key={index}
                    onClick={() => onGolferClick(golfer)}
                    className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                  >
                    <span>{golfer.name}</span>
                    <span className={`font-bold ${isUnderPar ? 'text-red-500' : isOverPar ? 'text-green-500' : 'text-gray-500'}`}>
                      {toparStr === '0' ? 'E' : (isOverPar ? `+${toparStr}` : toparStr)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">No players drafted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamCard;
