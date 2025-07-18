import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Save, Edit, Users, Settings, Trophy } from 'lucide-react';
import type { LiveMatchData, Team, Player } from '@shared/schema';

export default function MatchSettings() {
  const [, params] = useRoute('/match-settings/:matchId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const matchId = params?.matchId ? parseInt(params.matchId) : null;
  const [isEditing, setIsEditing] = useState(false);
  const [matchData, setMatchData] = useState({
    venue: '',
    overs: 20,
    matchType: 'T20'
  });

  // Fetch match data
  const { data: currentMatch, isLoading } = useQuery<LiveMatchData>({
    queryKey: ['/api/matches', matchId, 'live'],
    enabled: !!matchId,
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams']
  });

  // Fetch team players
  const { data: team1Players = [] } = useQuery<Player[]>({
    queryKey: ['/api/teams', currentMatch?.match.team1Id, 'players'],
    enabled: !!currentMatch?.match.team1Id,
  });

  const { data: team2Players = [] } = useQuery<Player[]>({
    queryKey: ['/api/teams', currentMatch?.match.team2Id, 'players'],
    enabled: !!currentMatch?.match.team2Id,
  });

  useEffect(() => {
    if (currentMatch) {
      setMatchData({
        venue: currentMatch.match.venue || '',
        overs: currentMatch.match.overs,
        matchType: currentMatch.match.matchType
      });
    }
  }, [currentMatch]);

  const updateMatchMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const response = await apiRequest('PUT', `/api/matches/${matchId}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Match Updated",
        description: "Match settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update match settings.",
        variant: "destructive",
      });
    }
  });

  const handleSaveChanges = () => {
    updateMatchMutation.mutate(matchData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700">Loading match settings...</div>
        </div>
      </div>
    );
  }

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Match Not Found</h1>
              <p className="text-gray-600 mb-4">
                The requested match could not be found.
              </p>
              <Button onClick={() => setLocation('/')}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-cricket-primary text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/scorer/${matchId}`)}
                className="text-white hover:bg-cricket-secondary"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scorer
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Match Settings</h1>
                <p className="text-cricket-light">
                  {currentMatch.match.team1.name} vs {currentMatch.match.team2.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSaveChanges}
                    disabled={updateMatchMutation.isPending}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMatchMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="border-white text-white hover:bg-cricket-secondary"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-cricket-accent hover:bg-orange-600"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Settings
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="match" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="match">Match Details</TabsTrigger>
            <TabsTrigger value="teams">Team Information</TabsTrigger>
            <TabsTrigger value="players">Player Management</TabsTrigger>
          </TabsList>

          <TabsContent value="match" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Match Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      id="venue"
                      value={matchData.venue}
                      onChange={(e) => setMatchData({ ...matchData, venue: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Enter venue name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="matchType">Match Type</Label>
                    <Select 
                      value={matchData.matchType} 
                      onValueChange={(value) => setMatchData({ ...matchData, matchType: value })}
                      disabled={!isEditing}
                    >
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
                      id="overs"
                      type="number"
                      value={matchData.overs}
                      onChange={(e) => setMatchData({ ...matchData, overs: parseInt(e.target.value) || 20 })}
                      disabled={!isEditing}
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Match Status</Label>
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-white ${
                        currentMatch.match.status === 'live' ? 'bg-green-500' :
                        currentMatch.match.status === 'setup' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`}>
                        {currentMatch.match.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Toss Winner</Label>
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      {currentMatch.match.tossWinnerId === currentMatch.match.team1Id 
                        ? currentMatch.match.team1.name 
                        : currentMatch.match.team2.name}
                    </div>
                  </div>
                  <div>
                    <Label>Toss Decision</Label>
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      {currentMatch.match.tossDecision === 'bat' ? 'Bat First' : 'Bowl First'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {currentMatch.match.team1.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Team Name</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {currentMatch.match.team1.name}
                      </div>
                    </div>
                    <div>
                      <Label>Short Name</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {currentMatch.match.team1.shortName}
                      </div>
                    </div>
                    <div>
                      <Label>Players</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {team1Players.length} players
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {currentMatch.match.team2.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Team Name</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {currentMatch.match.team2.name}
                      </div>
                    </div>
                    <div>
                      <Label>Short Name</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {currentMatch.match.team2.shortName}
                      </div>
                    </div>
                    <div>
                      <Label>Players</Label>
                      <div className="p-2 bg-gray-50 rounded text-sm">
                        {team2Players.length} players
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{currentMatch.match.team1.name} Players</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {team1Players.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-600">{player.role}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          #{player.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{currentMatch.match.team2.name} Players</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {team2Players.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-600">{player.role}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          #{player.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}