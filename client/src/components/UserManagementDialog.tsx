import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertUserSchema, type User, type InsertUser } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const userFormSchema = insertUserSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  user?: User;
  franchiseId?: number; // If provided, this is franchise-level user management
  onSuccess?: () => void;
}

export function UserManagementDialog({
  isOpen,
  onClose,
  mode,
  user,
  franchiseId,
  onSuccess
}: UserManagementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      password: '',
      role: user?.role || 'player',
      franchiseId: franchiseId || user?.franchiseId || null,
      isActive: user?.isActive ?? true,
    },
  });

  // Determine API endpoints based on context
  const getApiEndpoint = () => {
    if (franchiseId) {
      return mode === 'create' 
        ? `/api/franchises/${franchiseId}/users`
        : `/api/franchises/${franchiseId}/users/${user?.id}`;
    }
    return mode === 'create' ? '/api/auth/register' : `/api/users/${user?.id}`;
  };

  const getQueryKey = () => {
    return franchiseId 
      ? [`/api/franchises/${franchiseId}/users`]
      : ['/api/users'];
  };

  // Create/Update user mutation
  const userMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const endpoint = getApiEndpoint();
      const method = mode === 'create' ? 'POST' : 'PUT';
      
      const payload = mode === 'edit' 
        ? { ...data, password: undefined } // Don't send password for edit
        : data;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${mode} user`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      toast({
        title: "Success",
        description: `User ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
      onSuccess?.();
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    userMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New User' : 'Edit User'}
            {franchiseId && ' to Franchise'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Create a new user account with role and permissions'
              : 'Update user information and role'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="john.doe@example.com" 
                      {...field}
                      disabled={mode === 'edit'} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'create' && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="scorer">Scorer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {!franchiseId && (
                        <>
                          <SelectItem value="franchise_admin">Franchise Admin</SelectItem>
                          <SelectItem value="global_admin">Global Admin</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={userMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={userMutation.isPending}>
                {userMutation.isPending 
                  ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                  : (mode === 'create' ? 'Create User' : 'Update User')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// User list component that can be reused
interface UserListProps {
  franchiseId?: number;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
}

export function UserList({ franchiseId, onEditUser, onDeleteUser }: UserListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = franchiseId 
    ? [`/api/franchises/${franchiseId}/users`]
    : ['/api/users'];

  const { data: users = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const endpoint = franchiseId 
        ? `/api/franchises/${franchiseId}/users`
        : '/api/users';
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return response.json();
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: User) => {
      const endpoint = franchiseId 
        ? `/api/franchises/${franchiseId}/users/${user.id}`
        : `/api/users/${user.id}`;
        
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Loading users...</div>;
  }

  if (!users.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found {franchiseId ? 'in this franchise' : ''}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user: User) => (
        <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <div className="font-medium">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Role: {user.role} | Status: {user.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="flex gap-2">
            {onEditUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditUser(user)}
              >
                Edit
              </Button>
            )}
            {onDeleteUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteUserMutation.mutate(user)}
                disabled={deleteUserMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}