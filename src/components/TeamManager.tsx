import React, { useState, useRef } from 'react';
import { Team, Golfer } from '../types';
import TeamCard from './TeamCard';
import { generateCreativeTeamName } from '../services/geminiService';
import { Wand2, X, Save, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';

interface TeamManagerProps {
  teams: Team[];
  updateTeam: (id: string, updates: Partial<Team>) => void;
  onGolferClick: (golfer: Golfer) => void;
}

const TeamManager: React.FC<TeamManagerProps> = ({ teams, updateTeam, onGolferClick }) => {
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditLogo(team.logoUrl);
  };

  const handleSave = () => {
    if (editingTeam) {
      updateTeam(editingTeam.id, { name: editName, logoUrl: editLogo });
      setEditingTeam(null);
    }
  };

  const handleGenerateName = async () => {
    if (!editingTeam) return;
    setIsGenerating(true);
    const newName = await generateCreativeTeamName();
    setEditName(newName);
    setIsGenerating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Max dimensions (keep it small for LocalStorage)
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64 JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        setEditLogo(dataUrl);
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-3xl font-serif text-gray-900">Team Management</h2>
          <p className="text-gray-500 mt-1">Customize the 20 teams in your league.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map(team => (
          <TeamCard
            key={team.id}
            team={team}
            onEdit={handleStartEdit}
            onGolferClick={onGolferClick}
          />
        ))}
      </div>

      {/* Modal for Editing */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-green-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-serif text-lg">Edit Team Details</h3>
              <button onClick={() => setEditingTeam(null)} className="hover:text-yellow-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">

              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <button
                    onClick={handleGenerateName}
                    disabled={isGenerating}
                    className="bg-green-100 text-green-800 px-3 py-2 rounded-lg hover:bg-green-200 flex items-center transition-colors disabled:opacity-50"
                    title="Generate Name with AI"
                  >
                    <Wand2 className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Logo Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>

                {/* File Upload Area */}
                <div className="flex items-center space-x-2 mb-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingImage}
                    className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isProcessingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isProcessingImage ? 'Processing...' : 'Upload Image'}
                  </button>
                  <span className="text-xs text-gray-400">OR</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* URL Fallback */}
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={editLogo}
                    onChange={(e) => setEditLogo(e.target.value)}
                    placeholder="https://... (or upload above)"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Upload an image or paste a URL.</p>
              </div>

              {/* Preview */}
              <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm mb-2">
                    {editLogo ? (
                      <img src={editLogo} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-green-800 text-white text-xl font-bold">
                        {editName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-800">{editName}</span>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isProcessingImage}
                className="px-4 py-2 bg-green-900 text-white text-sm rounded-lg hover:bg-green-800 flex items-center shadow-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManager;
