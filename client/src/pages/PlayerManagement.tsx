import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequestJson } from '@/lib/queryClient';
import { PlayerWithStats, InsertPlayer, Team, Franchise } from '@shared/schema';
import { Plus, Search, Edit, Trash2, User, Trophy, Target } from 'lucide-react';

export default function PlayerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithStats | null>(null);

  // Fetch all players
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['/api/players'],
    queryFn: () => apiRequestJson('/api/players'),
  });

  // Fetch available players
  const { data: availablePlayers = [] } = useQuery({
    queryKey: ['/api/players/available'],
    queryFn: () => apiRequestJson('/api/players/available'),
  });

  // Fetch teams for dropdown
  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: () => apiRequestJson('/api/teams'),
  });

  // Fetch franchises for filter dropdown
  const { data: franchises = [] } = useQuery({
    queryKey: ['/api/franchises'],
    queryFn: () => apiRequestJson('/api/franchises'),
  });

  // Search players
  const { data: searchResults = [], refetch: searchPlayers } = useQuery({
    queryKey: ['/api/players/search', searchQuery],
    queryFn: () => apiRequestJson(`/api/players/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: false,
  });

  // Filter players by franchise
  const filteredPlayers = useMemo(() => {
    if (selectedFranchiseId === 'all') return players;
    return players.filter((player: PlayerWithStats) => 
      player.franchiseId === parseInt(selectedFranchiseId)
    );
  }, [players, selectedFranchiseId]);

  const filteredAvailablePlayers = useMemo(() => {
    if (selectedFranchiseId === 'all') return availablePlayers;
    return availablePlayers.filter((player: PlayerWithStats) => 
      player.franchiseId === parseInt(selectedFranchiseId)
    );
  }, [availablePlayers, selectedFranchiseId]);

  // Create player mutation
  const createPlayerMutation = useMutation({
    mutationFn: (data: InsertPlayer) => apiRequestJson('/api/players', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/available'] });
      setIsAddDialogOpen(false);
      toast({ title: 'Success', description: 'Player created successfully!' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Update player mutation
  const updatePlayerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlayerWithStats> }) => 
      apiRequestJson(`/api/players/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/available'] });
      setEditingPlayer(null);
      toast({ title: 'Success', description: 'Player updated successfully!' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Delete player mutation
  const deletePlayerMutation = useMutation({
    mutationFn: (id: number) => apiRequestJson(`/api/players/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/available'] });
      toast({ title: 'Success', description: 'Player deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchPlayers();
    }
  };

  const handleCreatePlayer = (formData: FormData) => {
    const data = Object.fromEntries(formData.entries()) as any;
    createPlayerMutation.mutate({
      name: data.name,
      role: data.role,
      teamId: data.teamId ? parseInt(data.teamId) : null,
      battingOrder: data.battingOrder ? parseInt(data.battingOrder) : null,
      preferredPosition: data.preferredPosition,
      contactInfo: data.email ? { email: data.email, phone: data.phone } : null,
    });
  };

  const handleUpdatePlayer = (formData: FormData) => {
    if (!editingPlayer) return;

    const data = Object.fromEntries(formData.entries()) as any;
    updatePlayerMutation.mutate({
      id: editingPlayer.id,
      data: {
        name: data.name,
        role: data.role,
        teamId: data.teamId ? parseInt(data.teamId) : null,
        battingOrder: data.battingOrder ? parseInt(data.battingOrder) : null,
        preferredPosition: data.preferredPosition,
        availability: data.availability === 'true',
        contactInfo: data.email ? { email: data.email, phone: data.phone } : null,
      }
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading players...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Player Management</h1>
          <p className="text-gray-600">Manage your cricket player pool</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
              <DialogDescription>Create a new player profile</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePlayer(new FormData(e.currentTarget)); }}>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="name">Player Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="batsman">Batsman</SelectItem>
                      <SelectItem value="bowler">Bowler</SelectItem>
                      <SelectItem value="allrounder">All-rounder</SelectItem>
                      <SelectItem value="wicketkeeper">Wicket Keeper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="teamId">Team (Optional)</Label>
                  <Select name="teamId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="preferredPosition">Preferred Position</Label>
                  <Select name="preferredPosition">
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opening">Opening</SelectItem>
                      <SelectItem value="middle">Middle Order</SelectItem>
                      <SelectItem value="tail">Tail Ender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input id="phone" name="phone" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createPlayerMutation.isPending}>
                  {createPlayerMutation.isPending ? 'Creating...' : 'Create Player'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Franchise Filter */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="franchise-filter" className="text-sm font-medium">
            Filter by Franchise:
          </Label>
          <Select value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select franchise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Franchises</SelectItem>
              {franchises.map((franchise: Franchise) => (
                <SelectItem key={franchise.id} value={franchise.id.toString()}>
                  {franchise.name} ({franchise.shortName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFranchiseId !== 'all' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedFranchiseId('all')}
            >
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Players ({filteredPlayers.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({filteredAvailablePlayers.length})</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlayers.map((player: PlayerWithStats) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onEdit={() => setEditingPlayer(player)}
                onDelete={() => deletePlayerMutation.mutate(player.id)}
              />
            ))}
          </div>
          {filteredPlayers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {selectedFranchiseId === 'all' 
                ? 'No players found.' 
                : 'No players found for selected franchise.'}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAvailablePlayers.map((player: PlayerWithStats) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onEdit={() => setEditingPlayer(player)}
                onDelete={() => deletePlayerMutation.mutate(player.id)}
              />
            ))}
          </div>
          {filteredAvailablePlayers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {selectedFranchiseId === 'all' 
                ? 'No available players found.' 
                : 'No available players found for selected franchise.'}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search">
          <div className="mb-6">
            <div className="flex gap-2">
              <Input
                placeholder="Search players by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {searchResults
              .filter((player: PlayerWithStats) => 
                selectedFranchiseId === 'all' || player.franchiseId === parseInt(selectedFranchiseId)
              )
              .map((player: PlayerWithStats) => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onEdit={() => setEditingPlayer(player)}
                onDelete={() => deletePlayerMutation.mutate(player.id)}
              />
            ))}
          </div>
          {searchResults.filter((player: PlayerWithStats) => 
            selectedFranchiseId === 'all' || player.franchiseId === parseInt(selectedFranchiseId)
          ).length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              {selectedFranchiseId === 'all' 
                ? `No players found matching "${searchQuery}".` 
                : `No players found matching "${searchQuery}" for selected franchise.`}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Player Dialog */}
      {editingPlayer && (
        <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Player</DialogTitle>
              <DialogDescription>Update player information</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdatePlayer(new FormData(e.currentTarget)); }}>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="edit-name">Player Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingPlayer.name} required />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select name="role" defaultValue={editingPlayer.role}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="batsman">Batsman</SelectItem>
                      <SelectItem value="bowler">Bowler</SelectItem>
                      <SelectItem value="allrounder">All-rounder</SelectItem>
                      <SelectItem value="wicketkeeper">Wicket Keeper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-availability">Availability</Label>
                  <Select name="availability" defaultValue={editingPlayer.availability ? 'true' : 'false'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Available</SelectItem>
                      <SelectItem value="false">Not Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input 
                    id="edit-email" 
                    name="email" 
                    type="email" 
                    defaultValue={(editingPlayer.contactInfo as any)?.email || ''} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updatePlayerMutation.isPending}>
                  {updatePlayerMutation.isPending ? 'Updating...' : 'Update Player'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PlayerCard({ 
  player, 
  onEdit, 
  onDelete 
}: { 
  player: PlayerWithStats; 
  onEdit: () => void; 
  onDelete: () => void; 
}) {
  const { data: franchises = [] } = useQuery({
    queryKey: ['/api/franchises'],
    queryFn: () => apiRequestJson('/api/franchises'),
  });

  const playerFranchise = franchises.find((f: Franchise) => f.id === player.franchiseId);
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'batsman': return 'bg-blue-100 text-blue-800';
      case 'bowler': return 'bg-red-100 text-red-800';
      case 'allrounder': return 'bg-purple-100 text-purple-800';
      case 'wicketkeeper': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            <CardTitle className="text-lg">{player.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className={getRoleColor(player.role)}>{player.role}</Badge>
          {!player.availability && <Badge variant="secondary">Unavailable</Badge>}
          {playerFranchise && (
            <Badge variant="outline" className="text-xs">
              {playerFranchise.shortName}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>{player.totalMatches} matches</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-green-600" />
            <span>{player.totalRuns} runs</span>
          </div>
          <div className="col-span-2 text-xs text-gray-500">
            Avg: {player.averageRuns.toFixed(1)} | Wickets: {player.totalWickets}
            {playerFranchise && (
              <div className="mt-1 text-xs text-blue-600">
                {playerFranchise.name}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}