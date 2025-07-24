import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

import { useToast } from '@/hooks/use-toast';
import { apiRequestJson, apiRequest } from '@/lib/queryClient';
import { Users, UserPlus, Edit, Trash2, Shield, ShieldCheck, User, Link } from 'lucide-react';
import type { User as UserType } from '@shared/schema';
import { TestDialog } from '@/components/TestDialog';

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLinkPlayerDialogOpen, setIsLinkPlayerDialogOpen] = useState(false);
  const [debugDialog, setDebugDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Fetch available players  
  const { data: availablePlayers = [], isLoading: playersLoading, error: playersError } = useQuery({
    queryKey: ['/api/players/available'],
    queryFn: () => apiRequestJson('/api/players/available'),
  });



  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'player' as const
  });

  const [editUser, setEditUser] = useState({
    firstName: '',
    lastName: '',
    role: 'player' as const,
    isActive: true,
    linkedPlayerId: null as number | null
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'player' });
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: { id: number } & Partial<UserType>) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      if (!response.ok) {
        const error = await response.json();  
        throw new Error(error.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  // Link player mutation
  const linkPlayerMutation = useMutation({
    mutationFn: async ({ userId, playerId }: { userId: number; playerId: number | null }) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${userId}/link-player`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to link player');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsLinkPlayerDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: 'Success',
        description: 'Player linked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to link player',
        variant: 'destructive',
      });
    },
  });



  const handleEditUser = (user: UserType) => {
    setSelectedUser(user);
    setEditUser({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as any,
      isActive: user.isActive ?? true,
      linkedPlayerId: (user as any).linkedPlayerId || null
    });
    setIsEditDialogOpen(true);
  };

  const handleLinkPlayer = (user: UserType) => {
    console.log('Link Player clicked for user:', user);
    setSelectedUser(user);
    setEditUser({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as any,
      isActive: user.isActive ?? true,
      linkedPlayerId: (user as any).linkedPlayerId || null
    });
    setIsLinkPlayerDialogOpen(true);
    console.log('Dialog should open now, isLinkPlayerDialogOpen:', true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500 text-white';
      case 'coach': return 'bg-blue-500 text-white';
      case 'scorer': return 'bg-green-500 text-white';
      case 'player': return 'bg-purple-500 text-white';
      case 'viewer': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredUsers = users.filter((user: any) =>
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );



  const getLinkedPlayer = (userId: number) => {
    const user = users.find((u: any) => u.id === userId) as any;
    if (!user?.linkedPlayerId) return null;
    return availablePlayers.find((p: any) => p.id === user.linkedPlayerId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage system users and their access permissions</p>
          <div className="flex gap-2 mt-2">
            <Button 
              onClick={() => {
                console.log('Force opening Link Player dialog');
                // Set a dummy user for testing
                setSelectedUser({
                  id: 1,
                  firstName: 'Test',
                  lastName: 'User',
                  email: 'test@test.com',
                  role: 'admin',
                  isActive: true
                } as any);
                setEditUser({
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'admin' as any,
                  isActive: true,
                  linkedPlayerId: null
                });
                setIsLinkPlayerDialogOpen(true);
              }} 
              size="sm" 
              variant="outline"
            >
              Test Link Dialog
            </Button>
            <TestDialog />
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the cricket scoring system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Secure password"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(value: any) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="scorer">Scorer</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsCreateDialogOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button 
                onClick={() => createUserMutation.mutate(newUser)}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      {usersLoading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">Loading users...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((user: any) => {
            const linkedPlayer = getLinkedPlayer(user.id);
            return (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-gray-600">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                          {!user.isActive && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                          {linkedPlayer && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Link className="w-3 h-3" />
                              Player: {linkedPlayer.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          console.log('Link Player button clicked!');
                          handleLinkPlayer(user);
                        }}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <Link className="w-4 h-4" />
                        {linkedPlayer ? 'Change Link' : 'Link Player'}
                      </Button>
                      <Button
                        onClick={() => handleEditUser(user)}
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredUsers.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">No users found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    value={editUser.firstName}
                    onChange={(e) => setEditUser(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    value={editUser.lastName}
                    onChange={(e) => setEditUser(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select value={editUser.role} onValueChange={(value: any) => setEditUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="scorer">Scorer</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={editUser.isActive}
                  onCheckedChange={(checked) => setEditUser(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active User</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsEditDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={() => selectedUser && updateUserMutation.mutate({ id: selectedUser.id, ...editUser })}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Player Dialog */}
      <Dialog open={isLinkPlayerDialogOpen} onOpenChange={setIsLinkPlayerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Player Account</DialogTitle>
            <DialogDescription>
              Connect this user account to a player profile for integrated functionality
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>User:</strong> {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </p>
              </div>
              
              <div>
                <Label>Select Player</Label>
                {playersLoading ? (
                  <div className="p-3 text-center text-gray-500">
                    Loading players...
                  </div>
                ) : playersError ? (
                  <div className="p-3 text-center text-red-500">
                    Error loading players. Please try again.
                  </div>
                ) : (
                  <Select 
                    value={editUser.linkedPlayerId?.toString() || ''} 
                    onValueChange={(value) => setEditUser(prev => ({ ...prev, linkedPlayerId: value ? parseInt(value) : null }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a player to link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Remove link)</SelectItem>
                      {availablePlayers.map((player: any) => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} - {player.role} ({player.teamId ? 'Team ID: ' + player.teamId : 'No team'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {availablePlayers.length === 0 && !playersLoading && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>No players available:</strong> All players are already linked to user accounts. 
                    Create new players in Player Management to link them here.
                  </p>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Benefits of linking:</strong> When a user is linked to a player profile, 
                  their match statistics and performance data are automatically connected. 
                  This enables personalized dashboards and integrated player-user experiences.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsLinkPlayerDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={() => selectedUser && linkPlayerMutation.mutate({ 
                userId: selectedUser.id, 
                playerId: editUser.linkedPlayerId 
              })}
              disabled={linkPlayerMutation.isPending}
            >
              {linkPlayerMutation.isPending ? 'Linking...' : 'Link Player'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Test Dialog */}
      <Dialog open={debugDialog} onOpenChange={setDebugDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debug Dialog Test</DialogTitle>
            <DialogDescription>
              This is a test dialog to verify the dialog system works
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>If you can see this, dialogs are working properly!</p>
            <p>isLinkPlayerDialogOpen: {isLinkPlayerDialogOpen.toString()}</p>
            <p>Available players count: {availablePlayers.length}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDebugDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}