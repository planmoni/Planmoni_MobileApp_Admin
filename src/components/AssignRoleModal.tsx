import { useState } from 'react';
import { X, UserPlus, Search } from 'lucide-react';

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userId: string, roleIds: string[]) => void;
  users: User[];
  roles: Role[];
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: any[];
}

interface Role {
  role_id: string;
  role_name: string;
  role_color: string;
  role_description: string;
}

export function AssignRoleModal({ isOpen, onClose, onSubmit, users, roles }: AssignRoleModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId && selectedRoleIds.length > 0) {
      onSubmit(selectedUserId, selectedRoleIds);
      setSelectedUserId('');
      setSelectedRoleIds([]);
      setSearchQuery('');
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const userExistingRoles = selectedUser?.roles.map(r => r.role_id) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Assign Roles</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      selectedUserId === user.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="user"
                      value={user.id}
                      checked={selectedUserId === user.id}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="h-10 w-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {user.email}
                      </div>
                      {user.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.roles.map((role: any) => (
                            <span
                              key={role.role_id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${role.role_color}20`,
                                color: role.role_color
                              }}
                            >
                              {role.role_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </div>

            {selectedUserId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Roles ({selectedRoleIds.length} selected)
                </label>
                <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                  {roles.map((role) => {
                    const hasRole = userExistingRoles.includes(role.role_id);
                    return (
                      <label
                        key={role.role_id}
                        className={`flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                          hasRole ? 'bg-gray-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(role.role_id) || hasRole}
                          onChange={() => !hasRole && toggleRole(role.role_id)}
                          disabled={hasRole}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: role.role_color }}
                            />
                            <span className="font-medium text-gray-900">
                              {role.role_name}
                            </span>
                            {hasRole && (
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                Already assigned
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {role.role_description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedUserId || selectedRoleIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-4 w-4" />
              Assign Roles
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
