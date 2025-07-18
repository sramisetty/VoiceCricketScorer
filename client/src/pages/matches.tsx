import { useState } from 'react';
import { Link } from 'wouter';
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
  const [isNewMatchDialogOpen, setIsNewMatchDialogOpen] = useState(false);
  const [newMatchData, setNewMatchData] = useState({
    team1Id: '',
    team2Id: '',
    matchType: 'T20',
    overs: 20,
    venue: '',
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });

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

  const formatDate = (dateString: string) => {
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
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Cricket Matches</h1>
              <p className="text-cricket-light mt-2">Manage your cricket matches and scoring</p>
            </div>
            <Dialog open={isNewMatchDialogOpen} onOpenChange={setIsNewMatchDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-cricket-accent hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  New Match
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
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Live Matches */}
        <div className="mb-8">
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

        {/* Setup Matches */}
        <div className="mb-8">
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
                          <Button className="w-full bg-green-500 hover:bg-green-600">
                            <Play className="w-4 h-4 mr-2" />
                            Start Match
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

        {/* Completed Matches */}
        {completedMatches.length > 0 && (
          <div className="mb-8">
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