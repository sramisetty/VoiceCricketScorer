import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFranchiseSchema, insertPlayerSchema, type Franchise, type InsertFranchise, type User, type PlayerWithStats, type InsertPlayer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { UserManagementDialog, UserList, LinkPlayerDialog } from "@/components/UserManagementDialog";
import { Plus, Users, Trophy, Building, Edit, Trash2, Settings, Search, UserPlus } from "lucide-react";

export default function FranchiseManagementComplete() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Fetch franchises
  const { data: allFranchises, isLoading: isLoadingFranchises } = useQuery({
    queryKey: ['/api/franchises'],
  });

  // Filter franchises based on user role
  const franchises = useMemo(() => {
    if (!allFranchises || !currentUser) return [];
    
    // Global admins and admins can see ALL franchises regardless of franchise association
    if (currentUser.role === 'admin' || currentUser.role === 'global_admin') {
      return allFranchises;
    }
    
    // Franchise admins can only see their associated franchise
    if (currentUser.role === 'franchise_admin' && currentUser.franchiseId) {
      return allFranchises.filter((franchise: Franchise) => 
        franchise.id === currentUser.franchiseId
      );
    }
    
    // Other roles cannot see any franchises
    return [];
  }, [allFranchises, currentUser]);

  // Pagination logic for franchises
  const totalPages = Math.ceil(franchises.length / itemsPerPage);
  const paginatedFranchises = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return franchises.slice(startIndex, startIndex + itemsPerPage);
  }, [franchises, currentPage, itemsPerPage]);

  // Create franchise mutation
  const createFranchiseMutation = useMutation({
    mutationFn: async (data: InsertFranchise) => {
      const response = await fetch('/api/franchises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create franchise');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/franchises'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Franchise created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create franchise",
        variant: "destructive",
      });
    },
  });

  // Update franchise mutation
  const updateFranchiseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertFranchise> }) => {
      const response = await fetch(`/api/franchises/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update franchise');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/franchises'] });
      setIsEditDialogOpen(false);
      setEditingFranchise(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Franchise updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update franchise",
        variant: "destructive",
      });
    },
  });

  // Delete franchise mutation
  const deleteFranchiseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/franchises/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete franchise');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/franchises'] });
      toast({
        title: "Success",
        description: "Franchise deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete franchise",
        variant: "destructive",
      });
    },
  });

  // Create form setup
  const form = useForm<InsertFranchise>({
    resolver: zodResolver(insertFranchiseSchema),
    defaultValues: {
      name: "",
      shortName: "",
      description: null,
      location: null,
      contactEmail: null,
      contactPhone: null,
      website: null,
    },
  });

  // Edit form setup
  const editForm = useForm<InsertFranchise>({
    resolver: zodResolver(insertFranchiseSchema),
    defaultValues: {
      name: "",
      shortName: "",
      description: null,
      location: null,
      contactEmail: null,
      contactPhone: null,
      website: null,
    },
  });

  const onSubmit = (data: InsertFranchise) => {
    createFranchiseMutation.mutate(data);
  };

  const onEditSubmit = (data: InsertFranchise) => {
    if (editingFranchise) {
      updateFranchiseMutation.mutate({ id: editingFranchise.id, data });
    }
  };

  const handleEdit = (franchise: Franchise) => {
    setEditingFranchise(franchise);
    editForm.reset({
      name: franchise.name,
      shortName: franchise.shortName,
      description: franchise.description,
      location: franchise.location,
      contactEmail: franchise.contactEmail,
      contactPhone: franchise.contactPhone,
      website: franchise.website,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (franchiseId: number) => {
    deleteFranchiseMutation.mutate(franchiseId);
  };

  const handleManage = (franchise: Franchise) => {
    setSelectedFranchise(franchise);
    setIsManageDialogOpen(true);
  };

  if (isLoadingFranchises) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center">Loading franchises...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Franchise Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage cricket franchises, teams, and players in your league
          </p>
        </div>
        {/* Only Global Admins can create franchises */}
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'global_admin') && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Franchise
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Franchise</DialogTitle>
              <DialogDescription>
                Add a new franchise to the cricket league with all necessary details and contact information.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Franchise Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Mumbai Warriors" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shortName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Name</FormLabel>
                        <FormControl>
                          <Input placeholder="MW" maxLength={10} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the franchise..."
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Mumbai, India" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="contact@mumbaiwarriors.com" 
                            {...field}
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://mumbaiwarriors.com" 
                            {...field}
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createFranchiseMutation.isPending}>
                    {createFranchiseMutation.isPending ? "Creating..." : "Create Franchise"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Edit Franchise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Franchise</DialogTitle>
            <DialogDescription>
              Update franchise information, contact details, and settings.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Franchise Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mumbai Warriors" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="shortName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Name</FormLabel>
                      <FormControl>
                        <Input placeholder="MW" maxLength={10} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of the franchise..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Mumbai, India" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="contact@mumbaiwarriors.com" 
                          {...field}
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 98765 43210" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://mumbaiwarriors.com" 
                          {...field}
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateFranchiseMutation.isPending}>
                  {updateFranchiseMutation.isPending ? "Updating..." : "Update Franchise"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Franchise Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage {selectedFranchise?.name}</DialogTitle>
            <DialogDescription>
              Manage franchise users, teams, players, and detailed settings for this franchise.
            </DialogDescription>
          </DialogHeader>
          {selectedFranchise && (
            <FranchiseDetailsManager franchise={selectedFranchise} />
          )}
        </DialogContent>
      </Dialog>

      {/* Franchises Grid */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedFranchises?.map((franchise: Franchise) => (
            <FranchiseCard 
              key={franchise.id} 
              franchise={franchise}
              currentUser={currentUser}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManage={handleManage}
            />
          ))}
        </div>

        {!franchises?.length && (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No franchises</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new franchise.</p>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={franchises.length}
        />
      </div>
    </div>
  );
}

function FranchiseCard({ 
  franchise, 
  currentUser,
  onEdit, 
  onDelete, 
  onManage 
}: { 
  franchise: Franchise;
  currentUser: User | null;
  onEdit: (franchise: Franchise) => void;
  onDelete: (franchiseId: number) => void;
  onManage: (franchise: Franchise) => void;
}) {
  const { data: teams } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/teams`],
  });

  const { data: players, refetch: refetchPlayers } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/players`],
  });

  // Force refresh players when component mounts or franchise changes
  useEffect(() => {
    refetchPlayers();
  }, [franchise.id, refetchPlayers]);

  const { data: users } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/users`],
    retry: false,
  });

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{franchise.name}</CardTitle>
              <CardDescription>{franchise.shortName}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {franchise.location && (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Building className="w-3 h-3" />
            {franchise.location}
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center mb-1">
              <Trophy className="w-4 h-4 mr-1" />
            </div>
            <div className="text-2xl font-bold">{(teams as any)?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Teams</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1">
              <Users className="w-4 h-4 mr-1" />
            </div>
            <div className="text-2xl font-bold">{(players as any)?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Players</div>
          </div>
          <div>
            <div className="flex items-center justify-center mb-1">
              <Users className="w-4 h-4 mr-1" />
            </div>
            <div className="text-2xl font-bold">{(users as any)?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Users</div>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Only Global Admins can edit franchises */}
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'global_admin') && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(franchise)}
              className="flex-1"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onManage(franchise)}
            className="flex-1"
          >
            <Settings className="w-3 h-3 mr-1" />
            Manage
          </Button>
          {/* Only Global Admins can delete franchises */}
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'global_admin') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Franchise</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{franchise.name}"? This will deactivate the franchise but preserve all historical data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(franchise.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FranchiseDetailsManager({ franchise }: { franchise: Franchise }) {
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'players'>('users');
  
  return (
    <div className="space-y-6">
      {/* Franchise Info */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{franchise.name}</h3>
            <p className="text-sm text-muted-foreground">{franchise.location}</p>
          </div>
          <Badge variant="secondary">{franchise.shortName}</Badge>
        </div>
        {franchise.description && (
          <p className="text-sm mt-2">{franchise.description}</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('users')}
          className="flex-1"
        >
          <Users className="w-4 h-4 mr-2" />
          Users
        </Button>
        <Button
          variant={activeTab === 'teams' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('teams')}
          className="flex-1"
        >
          <Trophy className="w-4 h-4 mr-2" />
          Teams
        </Button>
        <Button
          variant={activeTab === 'players' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('players')}
          className="flex-1"
        >
          <Users className="w-4 h-4 mr-2" />
          Players
        </Button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'users' && <FranchiseUsers franchiseId={franchise.id} />}
        {activeTab === 'teams' && <FranchiseTeams franchiseId={franchise.id} />}
        {activeTab === 'players' && <FranchisePlayers franchiseId={franchise.id} />}
      </div>
    </div>
  );
}

function FranchiseUsers({ franchiseId }: { franchiseId: number }) {
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isLinkPlayerDialogOpen, setIsLinkPlayerDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    // The UserList component handles deletion internally
  };

  const handleLinkPlayer = (user: User) => {
    setSelectedUser(user);
    setIsLinkPlayerDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Franchise Users</h4>
        <Button size="sm" onClick={() => setIsCreateUserDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>
      
      <UserList 
        franchiseId={franchiseId}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        onLinkPlayer={handleLinkPlayer}
      />

      {/* Create User Dialog */}
      <UserManagementDialog
        isOpen={isCreateUserDialogOpen}
        onClose={() => setIsCreateUserDialogOpen(false)}
        mode="create"
        franchiseId={franchiseId}
      />

      {/* Edit User Dialog */}
      {selectedUser && (
        <UserManagementDialog
          isOpen={isEditUserDialogOpen}
          onClose={() => {
            setIsEditUserDialogOpen(false);
            setSelectedUser(null);
          }}
          mode="edit"
          user={selectedUser}
          franchiseId={franchiseId}
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
        franchiseId={franchiseId}
      />
    </div>
  );
}

function FranchiseTeams({ franchiseId }: { franchiseId: number }) {
  const { data: teams, isLoading } = useQuery({
    queryKey: [`/api/franchises/${franchiseId}/teams`],
  });

  if (isLoading) {
    return <div>Loading teams...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Franchise Teams</h4>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Team
        </Button>
      </div>
      
      {(teams as any)?.length > 0 ? (
        <div className="grid gap-4">
          {(teams as any).map((team: any) => (
            <Card key={team.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{team.name}</div>
                  <div className="text-sm text-muted-foreground">{team.shortName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    View Players
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No teams in this franchise yet.
        </div>
      )}
    </div>
  );
}

function FranchisePlayers({ franchiseId }: { franchiseId: number }) {
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const { data: players, isLoading } = useQuery({
    queryKey: [`/api/franchises/${franchiseId}/players`],
  });

  if (isLoading) {
    return <div>Loading players...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Franchise Players</h4>
        <Dialog open={isAddPlayerDialogOpen} onOpenChange={setIsAddPlayerDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <PlayerAddDialog 
            franchiseId={franchiseId}
            onClose={() => setIsAddPlayerDialogOpen(false)}
            onSuccess={() => {
              setIsAddPlayerDialogOpen(false);
              // Refresh players list will happen automatically via queryClient invalidation
            }}
          />
        </Dialog>
      </div>
      
      {(players as any)?.length > 0 ? (
        <div className="grid gap-4">
          {(players as any).map((player: any) => (
            <Card key={player.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{player.name}</div>
                  <div className="text-sm text-muted-foreground">{player.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{player.battingStyle}</Badge>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No players in this franchise yet.
        </div>
      )}
    </div>
  );
}

// Player Add Dialog Component
interface PlayerAddDialogProps {
  franchiseId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function PlayerAddDialog({ franchiseId, onClose, onSuccess }: PlayerAddDialogProps) {
  const [activeTab, setActiveTab] = useState('create');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for creating new player
  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema.omit({ franchiseId: true })),
    defaultValues: {
      name: '',
      role: 'batsman',
      battingOrder: null,
      userId: null,
      contactInfo: null,
      availability: true,
      preferredPosition: null,
    },
  });

  // Search existing players
  const { data: searchResults = [], refetch: searchPlayers, isLoading: searchLoading } = useQuery({
    queryKey: ['/api/players/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search players');
      return response.json();
    },
    enabled: false,
  });

  // Create new player mutation
  const createPlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ ...data, franchiseId }),
      });
      if (!response.ok) throw new Error('Failed to create player');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Player created successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/franchises/${franchiseId}/players`] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add existing player to franchise mutation
  const addExistingPlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const response = await fetch(`/api/franchises/${franchiseId}/players/${playerId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to add player to franchise');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Player added to franchise successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/franchises/${franchiseId}/players`] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreatePlayer = (data: InsertPlayer) => {
    createPlayerMutation.mutate(data);
  };

  const handleSearchPlayers = () => {
    if (searchQuery.trim()) {
      searchPlayers();
    }
  };

  const handleAddExistingPlayer = () => {
    if (selectedPlayerId) {
      addExistingPlayerMutation.mutate(selectedPlayerId);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Player to Franchise</DialogTitle>
        <DialogDescription>
          Create a new player or add an existing player from the system to this franchise.
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">
            <UserPlus className="w-4 h-4 mr-2" />
            Create New Player
          </TabsTrigger>
          <TabsTrigger value="existing">
            <Search className="w-4 h-4 mr-2" />
            Add Existing Player
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreatePlayer)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Virat Kohli" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          <SelectItem value="batsman">Batsman</SelectItem>
                          <SelectItem value="bowler">Bowler</SelectItem>
                          <SelectItem value="allrounder">All-rounder</SelectItem>
                          <SelectItem value="wicketkeeper">Wicket Keeper</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="battingOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batting Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="1-11" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferredPosition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Position</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="opening">Opening</SelectItem>
                          <SelectItem value="middle">Middle Order</SelectItem>
                          <SelectItem value="tail">Tail Ender</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPlayerMutation.isPending}>
                  {createPlayerMutation.isPending ? "Creating..." : "Create Player"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="existing" className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search players by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchPlayers()}
              />
              <Button onClick={handleSearchPlayers} disabled={searchLoading}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Search Results:</Label>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {searchResults.map((player: PlayerWithStats) => (
                    <Card 
                      key={player.id} 
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedPlayerId === player.id ? 'ring-2 ring-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedPlayerId(player.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {player.role} • Franchise ID: {player.franchiseId}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {player.stats ? `${(player.stats as any).totalMatches || 0} matches` : 'New player'}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddExistingPlayer} 
                disabled={!selectedPlayerId || addExistingPlayerMutation.isPending}
              >
                {addExistingPlayerMutation.isPending ? "Adding..." : "Add Selected Player"}
              </Button>
            </DialogFooter>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}