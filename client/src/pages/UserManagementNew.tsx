import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagementDialog, UserList, LinkPlayerDialog } from '@/components/UserManagementDialog';
import { Users, UserPlus } from 'lucide-react';
import type { User as UserType } from '@shared/schema';

export default function UserManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLinkPlayerDialogOpen, setIsLinkPlayerDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const handleEditUser = (user: UserType) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (user: UserType) => {
    // The UserList component handles deletion internally
  };

  const handleLinkPlayer = (user: UserType) => {
    setSelectedUser(user);
    setIsLinkPlayerDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage users and their access permissions</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserList 
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onLinkPlayer={handleLinkPlayer}
          />
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <UserManagementDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        mode="create"
      />

      {/* Edit User Dialog */}
      {selectedUser && (
        <UserManagementDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedUser(null);
          }}
          mode="edit"
          user={selectedUser}
        />
      )}

      {/* Link Player Dialog */}
      <LinkPlayerDialog
        isOpen={isLinkPlayerDialogOpen}
        onClose={() => {
          setIsLinkPlayerDialogOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}