import { useState } from 'react';
import { X, Save } from 'lucide-react';

const formatPermissionName = (name: string): string => {
  return name
    .split('.')
    .map(part => part.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
    .join(' - ');
};

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roleData: RoleFormData) => void;
  permissions: Permission[];
}

interface Permission {
  id: string;
  name: string;
  action: string;
  resource: string;
  description: string;
}

export interface RoleFormData {
  name: string;
  description: string;
  level: number;
  color: string;
  permissions: string[];
}

const colorOptions = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Red' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Teal' },
];

export function CreateRoleModal({ isOpen, onClose, onSubmit, permissions }: CreateRoleModalProps) {
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    level: 1,
    color: '#3B82F6',
    permissions: [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      name: '',
      description: '',
      level: 1,
      color: '#3B82F6',
      permissions: [],
    });
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New Role</h2>
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
                Role Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Content Manager"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Describe the role's responsibilities..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level
                </label>
                <input
                  type="number"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Higher = more authority</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`h-10 rounded-lg transition-all ${
                        formData.color === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-900'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Permissions ({formData.permissions.length} selected)
              </label>
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {Object.entries(
                  permissions.reduce((acc, permission) => {
                    const category = permission.resource.charAt(0).toUpperCase() + permission.resource.slice(1).replace('_', ' ');
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(permission);
                    return acc;
                  }, {} as Record<string, typeof permissions>)
                ).map(([category, categoryPermissions]) => {
                  const allSelected = categoryPermissions.every(p => formData.permissions.includes(p.id));
                  const someSelected = categoryPermissions.some(p => formData.permissions.includes(p.id));

                  const toggleCategory = () => {
                    if (allSelected) {
                      setFormData(prev => ({
                        ...prev,
                        permissions: prev.permissions.filter(id =>
                          !categoryPermissions.map(p => p.id).includes(id)
                        )
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        permissions: [...new Set([...prev.permissions, ...categoryPermissions.map(p => p.id)])]
                      }));
                    }
                  };

                  return (
                    <div key={category} className="border-b border-gray-100 last:border-b-0">
                      <div className="bg-gray-50 p-3 sticky top-0 z-10">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={input => {
                              if (input) input.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={toggleCategory}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="font-semibold text-gray-900">
                            {category} ({categoryPermissions.filter(p => formData.permissions.includes(p.id)).length}/{categoryPermissions.length})
                          </span>
                        </label>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {categoryPermissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">
                                {formatPermissionName(permission.name)}
                              </div>
                              {permission.description && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {permission.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
