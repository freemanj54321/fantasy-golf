import React, { useState } from 'react';
import { User as UserIcon, KeyRound, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from '../firebase';

const ProfilePage: React.FC = () => {
  const user = auth.currentUser;

  // --- Display Name ---
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // --- Password ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setNameError(null);
    setNameSuccess(false);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError('Display name cannot be empty.');
      return;
    }

    setNameSaving(true);
    try {
      await updateProfile(user, { displayName: trimmed });
      setNameSuccess(true);
    } catch (err: any) {
      setNameError(err.message || 'Failed to update display name.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      // Re-authenticate before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Current password is incorrect.');
      } else {
        setPasswordError(err.message || 'Failed to update password.');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8 pb-4 border-b border-green-700">
        <h1 className="page-title flex items-center mb-0">
          <UserIcon className="w-8 h-8 mr-3 text-yellow-400" />
          My Profile
        </h1>
        <p className="mt-2 text-green-100">Update your display name and tournament password.</p>
      </div>

      {/* Display Name */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <UserIcon className="w-5 h-5 mr-2 text-green-700" />
          Display Name
        </h2>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameSuccess(false); }}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
              placeholder="Your display name"
            />
          </div>
          {nameError && (
            <p className="text-sm text-red-600">{nameError}</p>
          )}
          {nameSuccess && (
            <p className="text-sm text-green-700 flex items-center">
              <CheckCircle className="w-4 h-4 mr-1" /> Display name updated.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={nameSaving}
              className="btn-primary flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {nameSaving ? 'Saving...' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>

      {/* Tournament Password */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <KeyRound className="w-5 h-5 mr-2 text-green-700" />
          Tournament Password
        </h2>
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordSuccess(false); }}
                className="w-full p-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false); }}
                className="w-full p-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                placeholder="Minimum 6 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSuccess(false); }}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
              placeholder="Repeat new password"
              required
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-700 flex items-center">
              <CheckCircle className="w-4 h-4 mr-1" /> Password updated successfully.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="btn-primary flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {passwordSaving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
