import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestJson } from '@/lib/queryClient';
import { Users, UserPlus, X, Trophy } from 'lucide-react';
import type { PlayerWithStats } from '@shared/schema';

export default function MatchSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [matchData, setMatchData] = useState({
    team1Name: '',
    team1ShortName: '',
    team1FranchiseId: null as number | null,
    team2Name: '',
    team2ShortName: '',
    team2FranchiseId: null as number | null,
    matchType: 'T20',
    overs: 20,
    tossWinner: '',
    tossDecision: 'bat'
  });

  const [team1Players, setTeam1Players] = useState<PlayerWithStats[]>([]);
  const [team2Players, setTeam2Players] = useState<PlayerWithStats[]>([]);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<'team1' | 'team2'>('team1');
  const [isTeamSelectionDialogOpen, setIsTeamSelectionDialogOpen] = useState(false);
  const [currentTeamForSelection, setCurrentTeamForSelection] = useState<'team1' | 'team2'>('team1');

  // Fetch all franchises
  const { data: franchises = [], isLoading: franchisesLoading } = useQuery({
    queryKey: ['/api/franchises'],
    queryFn: () => apiRequestJson('/api/franchises'),
  });

  // Fetch available players (filtered by selected franchise in dialog)
  const { data: availablePlayers = [], isLoading: playersLoading } = useQuery({
    queryKey: ['/api/players/available'],
    queryFn: () => apiRequestJson('/api/players/available'),
  });

  // Fetch teams for selected franchise (for team selection/cloning)
  const { data: franchiseTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams', 'franchise', currentTeamForSelection === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId],
    queryFn: () => {
      const franchiseId = currentTeamForSelection === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
      if (!franchiseId) return [];
      return apiRequestJson(`/api/franchises/${franchiseId}/teams`);
    },
    enabled: isTeamSelectionDialogOpen && ((currentTeamForSelection === 'team1' && !!matchData.team1FranchiseId) || (currentTeamForSelection === 'team2' && !!matchData.team2FranchiseId))
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/matches', data);
      return response.json();
    },
    onSuccess: (match) => {
      toast({
        title: "Match Created Successfully",
        description: "Your cricket match has been set up and is ready to start.",
      });
      setLocation(`/scorer/${match.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create match. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async () => {
    // Validate required fields
    if (!matchData.team1Name || !matchData.team2Name) {
      toast({
        title: "Validation Error",
        description: "Please enter both team names.",
        variant: "destructive",
      });
      return;
    }

    if (!matchData.team1FranchiseId || !matchData.team2FranchiseId) {
      toast({
        title: "Validation Error",
        description: "Please select franchises for both teams.",
        variant: "destructive",
      });
      return;
    }

    if (team1Players.length < 11 || team2Players.length < 11) {
      toast({
        title: "Validation Error",
        description: "Please select all 11 players for both teams.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create teams first
      const team1Response = await apiRequest('POST', '/api/teams', {
        name: matchData.team1Name,
        shortName: matchData.team1ShortName || matchData.team1Name.substring(0, 3).toUpperCase()
      });
      const team1 = await team1Response.json();

      const team2Response = await apiRequest('POST', '/api/teams', {
        name: matchData.team2Name,
        shortName: matchData.team2ShortName || matchData.team2Name.substring(0, 3).toUpperCase()
      });
      const team2 = await team2Response.json();

      // Create players for team 1
      for (let i = 0; i < team1Players.length; i++) {
        await apiRequest('POST', '/api/players', {
          name: team1Players[i].name,
          teamId: team1.id,
          role: i === 0 ? 'captain' : team1Players[i].role,
          battingOrder: i + 1
        });
      }

      // Create players for team 2
      for (let i = 0; i < team2Players.length; i++) {
        await apiRequest('POST', '/api/players', {
          name: team2Players[i].name,
          teamId: team2.id,
          role: i === 0 ? 'captain' : team2Players[i].role,
          battingOrder: i + 1
        });
      }

      // Create match
      const tossWinnerId = matchData.tossWinner === 'team1' ? team1.id : team2.id;
      
      createMatchMutation.mutate({
        team1Id: team1.id,
        team2Id: team2.id,
        tossWinnerId,
        tossDecision: matchData.tossDecision,
        matchType: matchData.matchType,
        overs: matchData.overs,
        status: 'setup'
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create teams and players. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openPlayerDialog = (team: 'team1' | 'team2') => {
    const franchiseId = team === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
    
    if (!franchiseId) {
      toast({
        title: "Select Franchise First",
        description: `Please select a franchise for ${team === 'team1' ? 'Team 1' : 'Team 2'} before adding players.`,
        variant: "destructive",
      });
      return;
    }
    
    setCurrentTeam(team);
    setIsPlayerDialogOpen(true);
  };

  const addPlayerToTeam = (player: PlayerWithStats) => {
    const selectedPlayers = currentTeam === 'team1' ? team1Players : team2Players;
    const setPlayers = currentTeam === 'team1' ? setTeam1Players : setTeam2Players;
    
    // Check if player is already selected for this team
    if (selectedPlayers.some(p => p.id === player.id)) {
      toast({
        title: "Player Already Selected",
        description: `${player.name} is already in ${currentTeam === 'team1' ? 'Team 1' : 'Team 2'}.`,
        variant: "destructive",
      });
      return;
    }

    // Check if player is selected for the other team
    const otherTeamPlayers = currentTeam === 'team1' ? team2Players : team1Players;
    if (otherTeamPlayers.some(p => p.id === player.id)) {
      toast({
        title: "Player Already Selected",
        description: `${player.name} is already selected for the other team.`,
        variant: "destructive",
      });
      return;
    }

    // Check team limit
    if (selectedPlayers.length >= 11) {
      toast({
        title: "Team Full",
        description: "This team already has 11 players selected.",
        variant: "destructive",
      });
      return;
    }

    setPlayers([...selectedPlayers, player]);
  };

  const removePlayerFromTeam = (playerId: number, team: 'team1' | 'team2') => {
    if (team === 'team1') {
      setTeam1Players(team1Players.filter(p => p.id !== playerId));
    } else {
      setTeam2Players(team2Players.filter(p => p.id !== playerId));
    }
  };

  const openTeamSelectionDialog = (team: 'team1' | 'team2') => {
    const franchiseId = team === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
    
    if (!franchiseId) {
      toast({
        title: "Select Franchise First",
        description: `Please select a franchise for ${team === 'team1' ? 'Team 1' : 'Team 2'} before selecting existing teams.`,
        variant: "destructive",
      });
      return;
    }
    
    setCurrentTeamForSelection(team);
    setIsTeamSelectionDialogOpen(true);
  };

  const handleSelectExistingTeam = async (teamId: number) => {
    try {
      // Fetch team players
      const teamPlayers = await apiRequestJson(`/api/teams/${teamId}/players`);
      
      // Get team details
      const selectedTeam = franchiseTeams.find(t => t.id === teamId);
      
      if (!selectedTeam) {
        toast({
          title: "Error",
          description: "Team not found.",
          variant: "destructive",
        });
        return;
      }

      // Update team data and players
      if (currentTeamForSelection === 'team1') {
        setMatchData(prev => ({
          ...prev,
          team1Name: selectedTeam.name,
          team1ShortName: selectedTeam.shortName
        }));
        setTeam1Players(teamPlayers);
      } else {
        setMatchData(prev => ({
          ...prev,
          team2Name: selectedTeam.name,
          team2ShortName: selectedTeam.shortName
        }));
        setTeam2Players(teamPlayers);
      }

      setIsTeamSelectionDialogOpen(false);
      toast({
        title: "Team Selected",
        description: `${selectedTeam.name} has been selected with ${teamPlayers.length} players.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load team data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloneTeam = async (teamId: number) => {
    try {
      // Fetch team players
      const teamPlayers = await apiRequestJson(`/api/teams/${teamId}/players`);
      
      // Get team details
      const selectedTeam = franchiseTeams.find(t => t.id === teamId);
      
      if (!selectedTeam) {
        toast({
          title: "Error",
          description: "Team not found.",
          variant: "destructive",
        });
        return;
      }

      // Clone team data with modified name
      if (currentTeamForSelection === 'team1') {
        setMatchData(prev => ({
          ...prev,
          team1Name: `${selectedTeam.name} Clone`,
          team1ShortName: selectedTeam.shortName
        }));
        setTeam1Players(teamPlayers);
      } else {
        setMatchData(prev => ({
          ...prev,
          team2Name: `${selectedTeam.name} Clone`,
          team2ShortName: selectedTeam.shortName
        }));
        setTeam2Players(teamPlayers);
      }

      setIsTeamSelectionDialogOpen(false);
      toast({
        title: "Team Cloned",
        description: `${selectedTeam.name} has been cloned with ${teamPlayers.length} players. You can edit the team name and players.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clone team data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getAvailablePlayersForSelection = () => {
    const selectedPlayerIds = [...team1Players, ...team2Players].map(p => p.id);
    const franchiseId = currentTeam === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
    
    // Filter by franchise first, then exclude already selected players
    let filteredPlayers = availablePlayers;
    if (franchiseId) {
      filteredPlayers = availablePlayers.filter(player => player.franchiseId === franchiseId);
    }
    
    return filteredPlayers.filter(player => !selectedPlayerIds.includes(player.id));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cricket-primary mb-2">
            Create New Cricket Match
          </h1>
          <p className="text-gray-600">
            Set up teams, players, and match details to start voice scoring
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Match Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Franchise Selection Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Franchise Selection</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="team1Franchise">Team 1 Franchise</Label>
                  <Select 
                    value={matchData.team1FranchiseId?.toString() || ""} 
                    onValueChange={(value) => {
                      const franchiseId = value ? parseInt(value) : null;
                      setMatchData(prev => ({ ...prev, team1FranchiseId: franchiseId }));
                      // Clear team 1 players when franchise changes
                      setTeam1Players([]);
                    }}
                    disabled={team1Players.length > 0}
                  >
                    <SelectTrigger className={team1Players.length > 0 ? "opacity-50 cursor-not-allowed" : ""}>
                      <SelectValue placeholder="Select Team 1 Franchise" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id.toString()}>
                          {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {team1Players.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Franchise locked - remove all players to change
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="team2Franchise">Team 2 Franchise</Label>
                  <Select 
                    value={matchData.team2FranchiseId?.toString() || ""} 
                    onValueChange={(value) => {
                      const franchiseId = value ? parseInt(value) : null;
                      setMatchData(prev => ({ ...prev, team2FranchiseId: franchiseId }));
                      // Clear team 2 players when franchise changes
                      setTeam2Players([]);
                    }}
                    disabled={team2Players.length > 0}
                  >
                    <SelectTrigger className={team2Players.length > 0 ? "opacity-50 cursor-not-allowed" : ""}>
                      <SelectValue placeholder="Select Team 2 Franchise" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id.toString()}>
                          {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {team2Players.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Franchise locked - remove all players to change
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Team Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Team Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="team1Name">Team 1 Name</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openTeamSelectionDialog('team1')}
                      disabled={!matchData.team1FranchiseId}
                      className="text-xs"
                    >
                      Use Existing Team
                    </Button>
                  </div>
                  <Input
                    id="team1Name"
                    value={matchData.team1Name}
                    onChange={(e) => setMatchData(prev => ({ ...prev, team1Name: e.target.value }))}
                    placeholder="e.g., Mumbai Indians"
                  />
                </div>
              <div>
                <Label htmlFor="team1Short">Team 1 Short Name</Label>
                <Input
                  id="team1Short"
                  value={matchData.team1ShortName}
                  onChange={(e) => setMatchData(prev => ({ ...prev, team1ShortName: e.target.value }))}
                  placeholder="e.g., MI"
                  maxLength={3}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="team2Name">Team 2 Name</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openTeamSelectionDialog('team2')}
                    disabled={!matchData.team2FranchiseId}
                    className="text-xs"
                  >
                    Use Existing Team
                  </Button>
                </div>
                <Input
                  id="team2Name"
                  value={matchData.team2Name}
                  onChange={(e) => setMatchData(prev => ({ ...prev, team2Name: e.target.value }))}
                  placeholder="e.g., Chennai Super Kings"
                />
              </div>
              <div>
                <Label htmlFor="team2Short">Team 2 Short Name</Label>
                <Input
                  id="team2Short"
                  value={matchData.team2ShortName}
                  onChange={(e) => setMatchData(prev => ({ ...prev, team2ShortName: e.target.value }))}
                  placeholder="e.g., CSK"
                  maxLength={3}
                />
              </div>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="matchType">Match Type</Label>
                <Select value={matchData.matchType} onValueChange={(value) => {
                  setMatchData(prev => ({ 
                    ...prev, 
                    matchType: value,
                    overs: value === 'T20' ? 20 : value === 'ODI' ? 50 : 90
                  }));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T20">T20 (20 overs)</SelectItem>
                    <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                    <SelectItem value="Test">Test Match</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="overs">Overs per Innings</Label>
                <Input
                  id="overs"
                  type="number"
                  value={matchData.overs}
                  onChange={(e) => setMatchData(prev => ({ ...prev, overs: parseInt(e.target.value) }))}
                  min="1"
                  max="50"
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label>Toss Winner</Label>
              <RadioGroup 
                value={matchData.tossWinner} 
                onValueChange={(value) => setMatchData(prev => ({ ...prev, tossWinner: value }))}
                className="flex space-x-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="team1" id="toss-team1" />
                  <Label htmlFor="toss-team1">{matchData.team1Name || 'Team 1'}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="team2" id="toss-team2" />
                  <Label htmlFor="toss-team2">{matchData.team2Name || 'Team 2'}</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Toss Decision</Label>
              <RadioGroup 
                value={matchData.tossDecision} 
                onValueChange={(value) => setMatchData(prev => ({ ...prev, tossDecision: value }))}
                className="flex space-x-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bat" id="decision-bat" />
                  <Label htmlFor="decision-bat">Bat First</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bowl" id="decision-bowl" />
                  <Label htmlFor="decision-bowl">Bowl First</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Team 1 Players */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {matchData.team1Name || 'Team 1'} Players ({team1Players.length}/11)
              </CardTitle>
              <Button
                onClick={() => openPlayerDialog('team1')}
                size="sm"
                disabled={team1Players.length >= 11 || playersLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Add Player
              </Button>
            </CardHeader>
            <CardContent>
              {team1Players.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No players selected. Click "Add Player" to select from available players.
                </p>
              ) : (
                <div className="space-y-2">
                  {team1Players.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-6 justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-gray-500 capitalize">
                            {player.role} {index === 0 && '• Captain'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => removePlayerFromTeam(player.id, 'team1')}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team 2 Players */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {matchData.team2Name || 'Team 2'} Players ({team2Players.length}/11)
              </CardTitle>
              <Button
                onClick={() => openPlayerDialog('team2')}
                size="sm"
                disabled={team2Players.length >= 11 || playersLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Add Player
              </Button>
            </CardHeader>
            <CardContent>
              {team2Players.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No players selected. Click "Add Player" to select from available players.
                </p>
              ) : (
                <div className="space-y-2">
                  {team2Players.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-6 justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-gray-500 capitalize">
                            {player.role} {index === 0 && '• Captain'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => removePlayerFromTeam(player.id, 'team2')}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Player Selection Dialog */}
        <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                Select Players for {currentTeam === 'team1' ? matchData.team1Name || 'Team 1' : matchData.team2Name || 'Team 2'}
              </DialogTitle>
              <DialogDescription>
                {(() => {
                  const franchiseId = currentTeam === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
                  const franchise = franchises.find(f => f.id === franchiseId);
                  return `Showing players from ${franchise?.name || 'selected franchise'}. Selected players: ${currentTeam === 'team1' ? team1Players.length : team2Players.length}/11`;
                })()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-96">
              {playersLoading ? (
                <p className="text-center py-8">Loading available players...</p>
              ) : getAvailablePlayersForSelection().length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  No available players. All players have been selected or create new players in Player Management.
                </p>
              ) : (
                <div className="grid gap-3">
                  {getAvailablePlayersForSelection().map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => addPlayerToTeam(player)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="secondary" className="text-xs">
                              {player.role}
                            </Badge>
                            <span>•</span>
                            <span>{player.totalMatches} matches</span>
                            <span>•</span>
                            <span>{player.totalRuns} runs</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => addPlayerToTeam(player)}>
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setIsPlayerDialogOpen(false)} variant="outline">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Team Selection/Clone Dialog */}
        <Dialog open={isTeamSelectionDialogOpen} onOpenChange={setIsTeamSelectionDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                Select Team for {currentTeamForSelection === 'team1' ? matchData.team1Name || 'Team 1' : matchData.team2Name || 'Team 2'}
              </DialogTitle>
              <DialogDescription>
                {(() => {
                  const franchiseId = currentTeamForSelection === 'team1' ? matchData.team1FranchiseId : matchData.team2FranchiseId;
                  const franchise = franchises.find(f => f.id === franchiseId);
                  return `Choose an existing team from ${franchise?.name || 'selected franchise'} or clone one to customize.`;
                })()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-96">
              {teamsLoading ? (
                <p className="text-center py-8">Loading teams...</p>
              ) : franchiseTeams.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  No existing teams found for this franchise. Create a team manually by entering team details.
                </p>
              ) : (
                <div className="grid gap-3">
                  {franchiseTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{team.name}</h4>
                        <p className="text-sm text-gray-500">
                          Short: {team.shortName} • Created: {new Date(team.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSelectExistingTeam(team.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Use Exact Team
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloneTeam(team.id)}
                        >
                          Clone & Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTeamSelectionDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-center">
          <Button
            onClick={handleSubmit}
            disabled={createMatchMutation.isPending}
            className="bg-cricket-primary hover:bg-cricket-secondary text-white px-8 py-3 text-lg"
          >
            {createMatchMutation.isPending ? 'Creating Match...' : 'Create Match & Start Scoring'}
          </Button>
        </div>
      </div>
    </div>
  );
}
