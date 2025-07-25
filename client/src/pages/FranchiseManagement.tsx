import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFranchiseSchema, type Franchise, type InsertFranchise } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Trophy, Building, Edit, Trash2, Settings } from "lucide-react";

export default function FranchiseManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch franchises
  const { data: franchises, isLoading: isLoadingFranchises } = useQuery({
    queryKey: ['/api/franchises'],
  });

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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-lg">Loading franchises...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Franchise Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage cricket franchises and their associated teams and players
          </p>
        </div>

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
      </div>

      {/* Edit Franchise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Franchise</DialogTitle>
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
          </DialogHeader>
          {selectedFranchise && (
            <FranchiseDetailsManager franchise={selectedFranchise} />
          )}
        </DialogContent>
      </Dialog>

      {/* Franchises Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(franchises as Franchise[])?.map((franchise: Franchise) => (
          <FranchiseCard 
            key={franchise.id} 
            franchise={franchise}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onManage={handleManage}
          />
        ))}
      </div>

      {!(franchises as Franchise[])?.length && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Franchises Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first franchise to start organizing teams and players
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Franchise
          </Button>
        </div>
      )}
    </div>
  );
}

function FranchiseCard({ 
  franchise, 
  onEdit, 
  onDelete, 
  onManage 
}: { 
  franchise: Franchise;
  onEdit: (franchise: Franchise) => void;
  onDelete: (franchiseId: number) => void;
  onManage: (franchise: Franchise) => void;
}) {
  const { data: teams } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/teams`],
  });

  const { data: players } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/players`],
  });

  const { data: users } = useQuery({
    queryKey: [`/api/franchises/${franchise.id}/users`],
    retry: false, // Don't retry failed auth requests
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{franchise.name}</CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="secondary">{franchise.shortName}</Badge>
            </CardDescription>
          </div>
          {franchise.logo && (
            <img 
              src={franchise.logo} 
              alt={`${franchise.name} logo`} 
              className="w-12 h-12 rounded object-cover"
            />
          )}
        </div>
        {franchise.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {franchise.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {franchise.location && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Building className="w-4 h-4 mr-2" />
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(franchise)}
            className="flex-1"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onManage(franchise)}
            className="flex-1"
          >
            <Settings className="w-3 h-3 mr-1" />
            Manage
          </Button>
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
        </div>
      </CardContent>
    </Card>
  );
}