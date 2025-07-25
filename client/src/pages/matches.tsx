import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Play, Eye, Calendar, Clock, Users, Trophy, Target } from 'lucide-react';
import type { MatchWithTeams, Team } from '@shared/schema';

export default function Matches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isNewMatchDialogOpen, setIsNewMatchDialogOpen] = useState(false);
  const [isTossDialogOpen, setIsTossDialogOpen] = useState(false);
  const [selectedMatchForToss, setSelectedMatchForToss] = useState<any>(null);
  const [tossData, setTossData] = useState({
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });
  const [newMatchData, setNewMatchData] = useState({
    team1Id: '',
    team2Id: '',
    matchType: 'T20',
    overs: 20,
    venue: '',
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });

  // Fetch user for role-based access control
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Check if user has permission to create matches (system admins or franchise admins)
  const canCreateMatches = user && (
    (user as any).role === 'global_admin' || 
    (user as any).role === 'admin' ||
    (user as any).role === 'franchise_admin'
  );

  // Fetch all matches
  const { data: matches = [], isLoading: matchesLoading } = useQuery<MatchWithTeams[]>({
    queryKey: ['/api/matches'],
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Fetch all teams for match creation
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams']
  });

  const createMatchMutation = useMutation({
    mutationFn: async (matchData: any) => {
      const response = await apiRequest('POST', '/api/matches', {
        ...matchData,
        team1Id: parseInt(matchData.team1Id),
        team2Id: parseInt(matchData.team2Id),
        tossWinnerId: matchData.tossWinnerId ? parseInt(matchData.tossWinnerId) : null,
        status: 'setup'
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Match Created",
        description: "The match has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      setIsNewMatchDialogOpen(false);
      resetNewMatchForm();
    },
  });

  const startMatchMutation = useMutation({
    mutationFn: async ({ matchId, tossData }: { matchId: number, tossData: any }) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/start`, {
        tossWinnerId: parseInt(tossData.tossWinnerId),
        tossDecision: tossData.tossDecision
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Match Started",
        description: "The match has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      setIsTossDialogOpen(false);
      setSelectedMatchForToss(null);
      setTossData({ tossWinnerId: '', tossDecision: 'bat' });
      // Navigate to scorer page after successful start
      setLocation(`/scorer/${data.matchId || selectedMatchForToss?.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create match. Please try again.",
        variant: "destructive",
      });
    }
  });

  const resetNewMatchForm = () => {
    setNewMatchData({
      team1Id: '',
      team2Id: '',
      matchType: 'T20',
      overs: 20,
      venue: '',
      tossWinnerId: '',
      tossDecision: 'bat'
    });
  };

  const handleCreateMatch = () => {
    if (!newMatchData.team1Id || !newMatchData.team2Id) {
      toast({
        title: "Missing Information",
        description: "Please select both teams.",
        variant: "destructive",
      });
      return;
    }

    if (newMatchData.team1Id === newMatchData.team2Id) {
      toast({
        title: "Invalid Selection",
        description: "Please select different teams.",
        variant: "destructive",
      });
      return;
    }

    createMatchMutation.mutate(newMatchData);
  };

  const handleStartMatch = (match: any) => {
    console.log('Starting match:', match);
    console.log('Current isTossDialogOpen state:', isTossDialogOpen);
    setSelectedMatchForToss(match);
    setTossData({ tossWinnerId: match.team1Id.toString(), tossDecision: 'bat' });
    
    // Force state update
    setTimeout(() => {
      setIsTossDialogOpen(true);
      console.log('Set toss dialog to open');
    }, 100);
  };

  const handleTossSubmit = () => {
    if (!tossData.tossWinnerId) {
      toast({
        title: "Missing Information",
        description: "Please select toss winner.",
        variant: "destructive",
      });
      return;
    }

    startMatchMutation.mutate({
      matchId: selectedMatchForToss.id,
      tossData
    });
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'setup': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getMatchStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'Live';
      case 'completed': return 'Completed';
      case 'setup': return 'Setup';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const liveMatches = matches.filter(match => match.status === 'live');
  const setupMatches = matches.filter(match => match.status === 'setup');
  const completedMatches = matches.filter(match => match.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-cricket-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Cricket Matches</h1>
              <p className="text-cricket-light mt-2">Professional match management and live scoring</p>
            </div>
            <div className="flex gap-2">
              {!userLoading && canCreateMatches && (
                <Button 
                  onClick={() => setLocation('/match-setup')}
                  className="bg-cricket-accent hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Match
                </Button>
              )}
              {!userLoading && canCreateMatches && (
                <Dialog open={isNewMatchDialogOpen} onOpenChange={setIsNewMatchDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-white text-white hover:bg-white hover:text-cricket-primary">
                      <Plus className="w-4 h-4 mr-2" />
                      Quick Match
                    </Button>
                  </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Match</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="team1">Team 1</Label>
                      <Select value={newMatchData.team1Id} onValueChange={(value) => setNewMatchData({...newMatchData, team1Id: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map(team => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="team2">Team 2</Label>
                      <Select value={newMatchData.team2Id} onValueChange={(value) => setNewMatchData({...newMatchData, team2Id: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map(team => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="matchType">Match Type</Label>
                      <Select value={newMatchData.matchType} onValueChange={(value) => setNewMatchData({...newMatchData, matchType: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="T20">T20</SelectItem>
                          <SelectItem value="ODI">ODI</SelectItem>
                          <SelectItem value="Test">Test</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="overs">Overs</Label>
                      <Input
                        type="number"
                        value={newMatchData.overs}
                        onChange={(e) => setNewMatchData({...newMatchData, overs: parseInt(e.target.value) || 20})}
                        min="1"
                        max="50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      placeholder="Enter venue name"
                      value={newMatchData.venue}
                      onChange={(e) => setNewMatchData({...newMatchData, venue: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tossWinner">Toss Winner</Label>
                      <Select value={newMatchData.tossWinnerId} onValueChange={(value) => setNewMatchData({...newMatchData, tossWinnerId: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select winner" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.filter(team => 
                            team.id.toString() === newMatchData.team1Id || 
                            team.id.toString() === newMatchData.team2Id
                          ).map(team => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tossDecision">Toss Decision</Label>
                      <Select value={newMatchData.tossDecision} onValueChange={(value: 'bat' | 'bowl') => setNewMatchData({...newMatchData, tossDecision: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bat">Bat First</SelectItem>
                          <SelectItem value="bowl">Bowl First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleCreateMatch}
                      disabled={createMatchMutation.isPending}
                      className="flex-1"
                    >
                      {createMatchMutation.isPending ? 'Creating...' : 'Create Match'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsNewMatchDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black text-white p-2 text-xs z-50">
          Toss Dialog Open: {isTossDialogOpen ? 'true' : 'false'}
          <br />
          Selected Match: {selectedMatchForToss?.id || 'none'}
        </div>
      )}

      {/* Toss Dialog */}
      <Dialog open={isTossDialogOpen} onOpenChange={setIsTossDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Match - Toss Details</DialogTitle>
          </DialogHeader>
          
          {selectedMatchForToss && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg">
                  {selectedMatchForToss.team1.name} vs {selectedMatchForToss.team2.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedMatchForToss.matchType} • {selectedMatchForToss.overs} overs
                </p>
              </div>

              <div>
                <Label htmlFor="toss-winner">Toss Winner</Label>
                <Select
                  value={tossData.tossWinnerId}
                  onValueChange={(value) => setTossData({ ...tossData, tossWinnerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select toss winner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={selectedMatchForToss.team1Id.toString()}>
                      {selectedMatchForToss.team1.name}
                    </SelectItem>
                    <SelectItem value={selectedMatchForToss.team2Id.toString()}>
                      {selectedMatchForToss.team2.name}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="toss-decision">Toss Decision</Label>
                <Select
                  value={tossData.tossDecision}
                  onValueChange={(value: 'bat' | 'bowl') => setTossData({ ...tossData, tossDecision: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bat">Bat First</SelectItem>
                    <SelectItem value="bowl">Bowl First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleTossSubmit}
                  disabled={startMatchMutation.isPending}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  {startMatchMutation.isPending ? 'Starting Match...' : 'Start Match'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsTossDialogOpen(false)}
                  disabled={startMatchMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Live Matches */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h2 className="text-2xl font-bold text-gray-800">Live Matches</h2>
            <Badge variant="secondary">{liveMatches.length}</Badge>
          </div>
          
          {liveMatches.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Play className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No live matches at the moment</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1.name} vs {match.team2.name}
                      </CardTitle>
                      <Badge className={getMatchStatusColor(match.status)}>
                        {getMatchStatusText(match.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
                      </div>
                      
                      {match.venue && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{match.venue}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(match.createdAt)}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Link href={`/scorer/${match.id}`} className="flex-1">
                          <Button className="w-full bg-cricket-primary hover:bg-cricket-secondary">
                            <Play className="w-4 h-4 mr-2" />
                            Score
                          </Button>
                        </Link>
                        <Link href={`/scoreboard/${match.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Test Toss Dialog Button */}
        <div className="bg-yellow-100 p-4 rounded-lg mb-4">
          <h3 className="font-bold mb-2">Debug Test</h3>
          <Button 
            onClick={() => {
              console.log('Test button clicked');
              setSelectedMatchForToss({ id: 5, team1: { name: 'Chiefs' }, team2: { name: 'Lions' }, team1Id: 1, team2Id: 2, matchType: 'T20', overs: 20 });
              setTossData({ tossWinnerId: '1', tossDecision: 'bat' });
              setIsTossDialogOpen(true);
              console.log('Dialog should be open now');
            }}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Test Toss Dialog
          </Button>
        </div>
        
        {/* Setup Matches */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">Ready to Start</h2>
            <Badge variant="secondary">{setupMatches.length}</Badge>
          </div>
          
          {setupMatches.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No matches waiting to start</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {setupMatches.map((match) => (
                <Card key={match.id} className="border-2 border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1.name} vs {match.team2.name}
                      </CardTitle>
                      <Badge className={getMatchStatusColor(match.status)}>
                        {getMatchStatusText(match.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
                      </div>
                      
                      {match.venue && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{match.venue}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(match.createdAt)}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Start Match clicked for:', match.id);
                            handleStartMatch(match);
                          }}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center"
                          disabled={startMatchMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {startMatchMutation.isPending ? 'Starting...' : 'Start Match'}
                        </button>
                        <Link href={`/scoreboard/${match.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed Matches */}
        {completedMatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800">Completed Matches</h2>
              <Badge variant="secondary">{completedMatches.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedMatches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1.name} vs {match.team2.name}
                      </CardTitle>
                      <Badge className={getMatchStatusColor(match.status)}>
                        {getMatchStatusText(match.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
                      </div>
                      
                      {match.venue && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{match.venue}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(match.createdAt)}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Link href={`/scoreboard/${match.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            <Eye className="w-4 h-4 mr-2" />
                            View Results
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}