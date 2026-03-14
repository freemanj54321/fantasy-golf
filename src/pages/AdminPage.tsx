import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Settings, Server, Users, Trophy, Star } from 'lucide-react';
import { useYear } from '../contexts/YearContext';

const AdminPage: React.FC = () => {
  const { year } = useYear();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-green-700">
        <div>
          <h1 className="page-title flex items-center">
            <Shield className="w-8 h-8 mr-3 text-yellow-400" />
            Admin Dashboard
          </h1>
          <p className="mt-2 text-green-100">
            Manage league settings, roles, and automated data synchronization.
          </p>
        </div>
        <div className="text-lg font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
          Active Year: <span className="text-green-800 font-bold">{year}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Role Management Card */}
        <Link to="/admin/roles" className="group">
          <div className="card h-full flex flex-col hover:border-green-500 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-transparent">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Users className="w-8 h-8 text-blue-700" />
              </div>
              <h2 className="text-2xl font-bold ml-4 text-gray-800 group-hover:text-green-800 transition-colors">Role Management</h2>
            </div>
            <p className="text-gray-600 flex-grow">
              Assign administrative privileges to users. Control who can access this dashboard, run syncs, and modify league-wide settings.
            </p>
            <div className="mt-4 text-green-700 font-medium flex items-center">
              Manage Roles <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        {/* Auto-Sync Settings Card */}
        <Link to="/admin/autosync" className="group">
          <div className="card h-full flex flex-col hover:border-green-500 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-transparent">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Server className="w-8 h-8 text-purple-700" />
              </div>
              <h2 className="text-2xl font-bold ml-4 text-gray-800 group-hover:text-green-800 transition-colors">API Auto-Sync</h2>
            </div>
            <p className="text-gray-600 flex-grow">
              Configure background RapidAPI synchronization for the current active year. Run manual syncs, track execution logs, and set target tournaments.
            </p>
            <div className="mt-4 text-green-700 font-medium flex items-center">
              Configure Syncs <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        {/* Team Management Card */}
        <Link to="/admin/teams" className="group">
          <div className="card h-full flex flex-col hover:border-green-500 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-transparent">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                <Trophy className="w-8 h-8 text-yellow-700" />
              </div>
              <h2 className="text-2xl font-bold ml-4 text-gray-800 group-hover:text-green-800 transition-colors">Team Management</h2>
            </div>
            <p className="text-gray-600 flex-grow">
              View all teams across seasons. Rename teams, remove year entries, and manage cross-year team identity.
            </p>
            <div className="mt-4 text-green-700 font-medium flex items-center">
              Manage Teams <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        {/* Champions Locker Room */}
        <Link to="/champions" className="group">
          <div className="card h-full flex flex-col hover:border-green-500 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-transparent">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                <Star className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold ml-4 text-gray-800 group-hover:text-green-800 transition-colors">Champions Locker Room</h2>
            </div>
            <p className="text-gray-600 flex-grow">
              Finalize season records, enter historical data, and manage the all-time champions page visible to all users.
            </p>
            <div className="mt-4 text-green-700 font-medium flex items-center">
              Manage Records <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        {/* League Settings Placeholder Component */}
        <Link to="/admin" className="group opacity-50 cursor-not-allowed">
          <div className="card h-full flex flex-col border-2 border-transparent">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Settings className="w-8 h-8 text-gray-500" />
              </div>
              <h2 className="text-2xl font-bold ml-4 text-gray-600">League Settings</h2>
            </div>
            <p className="text-gray-500 flex-grow">
              (Coming Soon) Formally manage tournament name, league status, and visual configurations across the application.
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
};

export default AdminPage;
