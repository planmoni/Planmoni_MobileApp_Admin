import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

interface CreateRoleData {
  name: string;
  description: string;
  level: number;
  color: string;
  permissions: string[];
}

interface UpdateRoleData {
  name: string;
  description: string;
  level: number;
  color: string;
  permissions: string[];
}

interface AssignRolesData {
  userId: string;
  roleIds: string[];
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoleData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({
          name: data.name,
          description: data.description,
          level: data.level,
          color: data.color,
          is_system: false,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      if (data.permissions.length > 0) {
        const rolePermissions = data.permissions.map(permissionId => ({
          role_id: role.id,
          permission_id: permissionId,
        }));

        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (permError) throw permError;
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'create_role',
        resource_type: 'roles',
        resource_id: role.id,
        new_values: data,
      });

      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      showToast('Role created successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to create role', 'error');
    },
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: AssignRolesData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const userRoles = data.roleIds.map(roleId => ({
        user_id: data.userId,
        role_id: roleId,
        assigned_by: user.id,
        is_active: true,
        assigned_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('user_roles')
        .upsert(userRoles, {
          onConflict: 'user_id,role_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'assign_roles',
        resource_type: 'user_roles',
        resource_id: data.userId,
        new_values: { role_ids: data.roleIds },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      showToast('Roles assigned successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to assign roles', 'error');
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: UpdateRoleData }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: roleError } = await supabase
        .from('roles')
        .update({
          name: data.name,
          description: data.description,
          level: data.level,
          color: data.color,
        })
        .eq('id', roleId);

      if (roleError) throw roleError;

      const { error: deletePermError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (deletePermError) throw deletePermError;

      if (data.permissions.length > 0) {
        const rolePermissions = data.permissions.map(permissionId => ({
          role_id: roleId,
          permission_id: permissionId,
        }));

        const { error: insertPermError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (insertPermError) throw insertPermError;
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update_role',
        resource_type: 'roles',
        resource_id: roleId,
        new_values: data,
      });

      return roleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      showToast('Role updated successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to update role', 'error');
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: permError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (permError) throw permError;

      const { error: userRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('role_id', roleId);

      if (userRolesError) throw userRolesError;

      const { error: roleError } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('is_system', false);

      if (roleError) throw roleError;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete_role',
        resource_type: 'roles',
        resource_id: roleId,
      });

      return roleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
      showToast('Role deleted successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to delete role', 'error');
    },
  });
}
