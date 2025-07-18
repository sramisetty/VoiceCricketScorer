import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function MatchSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [matchData, setMatchData] = useState({
    team1Name: '',
    team1ShortName: '',
    team2Name: '',
    team2ShortName: '',
    matchType: 'T20',
    overs: 20,
    tossWinner: '',
    tossDecision: 'bat'
  });

  const [team1Players, setTeam1Players] = useState<string[]>(Array(11).fill(''));
  const [team2Players, setTeam2Players] = useState<string[]>(Array(11).fill(''));

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

    const validTeam1Players = team1Players.filter(name => name.trim());
    const validTeam2Players = team2Players.filter(name => name.trim());

    if (validTeam1Players.length < 11 || validTeam2Players.length < 11) {
      toast({
        title: "Validation Error",
        description: "Please enter all 11 players for both teams.",
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
      for (let i = 0; i < validTeam1Players.length; i++) {
        await apiRequest('POST', '/api/players', {
          name: validTeam1Players[i],
          teamId: team1.id,
          role: i === 0 ? 'captain' : 'batsman',
          battingOrder: i + 1
        });
      }

      // Create players for team 2
      for (let i = 0; i < validTeam2Players.length; i++) {
        await apiRequest('POST', '/api/players', {
          name: validTeam2Players[i],
          teamId: team2.id,
          role: i === 0 ? 'captain' : 'batsman',
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

  const updatePlayer = (team: 'team1' | 'team2', index: number, name: string) => {
    if (team === 'team1') {
      const updated = [...team1Players];
      updated[index] = name;
      setTeam1Players(updated);
    } else {
      const updated = [...team2Players];
      updated[index] = name;
      setTeam2Players(updated);
    }
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="team1Name">Team 1 Name</Label>
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
                <Label htmlFor="team2Name">Team 2 Name</Label>
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
          <Card>
            <CardHeader>
              <CardTitle>{matchData.team1Name || 'Team 1'} Players</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team1Players.map((player, index) => (
                  <div key={index}>
                    <Label htmlFor={`team1-player-${index}`}>
                      Player {index + 1} {index === 0 && '(Captain)'}
                    </Label>
                    <Input
                      id={`team1-player-${index}`}
                      value={player}
                      onChange={(e) => updatePlayer('team1', index, e.target.value)}
                      placeholder={`Enter player ${index + 1} name`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{matchData.team2Name || 'Team 2'} Players</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {team2Players.map((player, index) => (
                  <div key={index}>
                    <Label htmlFor={`team2-player-${index}`}>
                      Player {index + 1} {index === 0 && '(Captain)'}
                    </Label>
                    <Input
                      id={`team2-player-${index}`}
                      value={player}
                      onChange={(e) => updatePlayer('team2', index, e.target.value)}
                      placeholder={`Enter player ${index + 1} name`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

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
