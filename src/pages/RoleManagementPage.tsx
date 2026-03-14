import React, { useState, useEffect } from 'react';
import { Shield, User, Edit, Save, XCircle, Trash2, RefreshCw, UserPlus, X } from 'lucide-react';
import { auth_get_users, auth_update_user, auth_create_user, auth_delete_user, auth_update_user_name } from '../utils/firebaseApi';

interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: 'Administrator' | 'User';
  disabled: boolean;
}

const RoleManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'Administrator' | 'User'>('User');
  const [editName, setEditName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'User' as 'Administrator' | 'User'
  });
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const firebaseUsers = await auth_get_users();
      const formattedUsers: AuthUser[] = firebaseUsers.map((u: any) => ({
        uid: u.uid,
        name: u.displayName || 'N/A',
        email: u.email,
        role: u.customClaims?.admin ? 'Administrator' : 'User',
        disabled: u.disabled
      }));
      setUsers(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      // Handle error display to the user
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (user: AuthUser) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setEditName(user.name);
  };

  const handleSave = async () => {
    if (editingUser) {
      setLoading(true);
      try {
        const promises = [];

        // Role update
        if (editingUser.role !== selectedRole) {
          promises.push(auth_update_user(editingUser.uid, { customClaims: { admin: selectedRole === 'Administrator' } }));
        }

        // Name update
        if (editingUser.name !== editName) {
          promises.push(auth_update_user_name(editingUser.uid, editName));
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, role: selectedRole, name: editName || 'N/A' } : u));
        setEditingUser(null);
      } catch (error) {
        console.error("Error updating user:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
  };

  const handleToggleDisable = async (uid: string, isDisabled: boolean) => {
    setLoading(true);
    try {
      await auth_update_user(uid, { disabled: isDisabled });
      setUsers(users.map(u => u.uid === uid ? { ...u, disabled: isDisabled } : u));
    } catch (error) {
      console.error("Error toggling user state:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;

    setLoading(true);
    try {
      await auth_delete_user(uid);
      setUsers(users.filter(u => u.uid !== uid));
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password) {
      setAddError('Email and password are required');
      return;
    }

    setLoading(true);
    setAddError(null);

    try {
      const createdUser = await auth_create_user({
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName || undefined,
        role: newUser.role
      });

      setUsers([...users, {
        uid: createdUser.uid,
        name: createdUser.displayName || 'N/A',
        email: createdUser.email || '',
        role: newUser.role,
        disabled: false
      }]);

      setShowAddModal(false);
      setNewUser({ email: '', password: '', displayName: '', role: 'User' });
    } catch (error: any) {
      console.error("Error creating user:", error);
      setAddError(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-green-700">
        <div>
          <h1 className="page-title flex items-center mb-0">
            <Shield className="w-8 h-8 mr-3 text-yellow-400" />
            Role Management
          </h1>
          <p className="mt-2 text-green-100">
            Manage user roles and status directly from Firebase Authentication.
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center" disabled={loading}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </button>
          <button onClick={fetchUsers} className="btn-secondary flex items-center" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Users
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add New User</h2>
              <button onClick={() => { setShowAddModal(false); setAddError(null); }} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {addError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'Administrator' | 'User' })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 focus:border-transparent"
                >
                  <option value="User">User</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => { setShowAddModal(false); setAddError(null); }}
                  className="btn-secondary px-4 py-2"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="btn-primary px-4 py-2 flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Firebase Users</h2>

        {loading && <div className='text-center p-4'>Loading users...</div>}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm">User</th>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Role</th>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Status</th>
                  <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.uid} className={`border-b ${user.disabled ? 'bg-gray-50 text-gray-400' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full ${user.disabled ? 'bg-gray-300' : 'bg-gray-200'} flex items-center justify-center mr-3`}>
                          <User className="h-6 w-6 text-gray-500" />
                        </div>
                        <div>
                          {editingUser?.uid === user.uid ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="p-1 border rounded focus:ring-2 focus:ring-green-700 text-sm font-medium w-full max-w-[150px]"
                              placeholder="Display Name"
                            />
                          ) : (
                            <p className="font-medium">{user.name}</p>
                          )}
                          <p className="text-sm">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {editingUser?.uid === user.uid ? (
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as 'Administrator' | 'User')}
                          className="p-2 border rounded-lg focus:ring-2 focus:ring-green-700 text-sm"
                        >
                          <option value="Administrator">Administrator</option>
                          <option value="User">User</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'Administrator' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'} ${user.disabled ? 'opacity-50' : ''}`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.disabled ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                        {user.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingUser?.uid === user.uid ? (
                        <div className="flex items-center space-x-2">
                          <button onClick={handleSave} className="btn-primary text-sm px-3 py-1 flex items-center"><Save className='h-3 w-3 mr-1' />Save</button>
                          <button onClick={handleCancel} className="btn-secondary text-sm px-3 py-1 flex items-center"><XCircle className='h-3 w-3 mr-1' />Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditClick(user)}
                            className="flex items-center text-sm text-green-700 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                            disabled={editingUser !== null || loading}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleDisable(user.uid, !user.disabled)}
                            className={`flex items-center text-sm ${user.disabled ? 'text-blue-600 hover:text-blue-800' : 'text-red-600 hover:text-red-800'} disabled:text-gray-400 disabled:cursor-not-allowed`}
                            disabled={user.email === 'freemanj54321@gmail.com' || editingUser !== null || loading}
                          >
                            {user.disabled ? <User className="h-4 w-4 mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                            {user.disabled ? 'Enable' : 'Disable'}
                          </button>
                          {user.disabled && (
                            <button
                              onClick={() => handleDeleteUser(user.uid)}
                              className="flex items-center text-sm text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed ml-2"
                              disabled={user.email === 'freemanj54321@gmail.com' || editingUser !== null || loading}
                              title="Permanently delete user"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
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

export default RoleManagementPage;
