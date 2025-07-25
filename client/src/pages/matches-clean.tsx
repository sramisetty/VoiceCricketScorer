import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Eye, Trophy, Target, Clock, Users } from 'lucide-react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function MatchesClean() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State for toss dialog
  const [isTossDialogOpen, setIsTossDialogOpen] = useState(false);
  const [selectedMatchForToss, setSelectedMatchForToss] = useState<any>(null);
  const [tossData, setTossData] = useState({
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });

  // Fetch matches data
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['/api/matches'],
  });

  // Fetch user data for permissions
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/user'],
  });

  // Check if user can create matches
  const canCreateMatches = user && ['admin', 'global_admin', 'franchise_admin'].includes((user as any)?.role);

  // Start match mutation
  const startMatchMutation = useMutation({
    mutationFn: async (data: { matchId: number; tossWinnerId: string; tossDecision: string }) => {
      const response = await fetch(`/api/matches/${data.matchId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tossWinnerId: parseInt(data.tossWinnerId),
          tossDecision: data.tossDecision
        }),
      });
      if (!response.ok) throw new Error('Failed to start match');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      setIsTossDialogOpen(false);
      setSelectedMatchForToss(null);
      setLocation(`/scorer/${data.matchId}`);
      toast({
        title: "Match Started!",
        description: "The match has been started successfully with toss details.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to start match. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartMatch = (match: any) => {
    console.log('Starting match:', match);
    setSelectedMatchForToss(match);
    setTossData({ tossWinnerId: '', tossDecision: 'bat' });
    setIsTossDialogOpen(true);
  };

  const handleTossSubmit = () => {
    if (!selectedMatchForToss || !tossData.tossWinnerId) return;
    
    startMatchMutation.mutate({
      matchId: selectedMatchForToss.id,
      tossWinnerId: tossData.tossWinnerId,
      tossDecision: tossData.tossDecision
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p>Loading matches...</p>
      </div>
    );
  }

  const matchList = (matches as any[]) || [];
  const setupMatches = matchList.filter((match: any) => match.status === 'setup');
  const liveMatches = matchList.filter((match: any) => match.status === 'live');
  const completedMatches = matchList.filter((match: any) => match.status === 'completed');

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
            </div>
          </div>
        </div>
      </header>

      {/* Toss Dialog */}
      {isTossDialogOpen && selectedMatchForToss && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setIsTossDialogOpen(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
              Start Match - Toss Details
            </h2>
            
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '18px' }}>
                {selectedMatchForToss.team1?.name || 'Team 1'} vs {selectedMatchForToss.team2?.name || 'Team 2'}
              </h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                {selectedMatchForToss.matchType} • {selectedMatchForToss.overs} overs
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Toss Winner</label>
              <select 
                value={tossData.tossWinnerId}
                onChange={(e) => setTossData({ ...tossData, tossWinnerId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              >
                <option value="">Select toss winner</option>
                <option value={selectedMatchForToss.team1Id?.toString() || '1'}>
                  {selectedMatchForToss.team1?.name || 'Team 1'}
                </option>
                <option value={selectedMatchForToss.team2Id?.toString() || '2'}>
                  {selectedMatchForToss.team2?.name || 'Team 2'}
                </option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Toss Decision</label>
              <select 
                value={tossData.tossDecision}
                onChange={(e) => setTossData({ ...tossData, tossDecision: e.target.value as 'bat' | 'bowl' })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              >
                <option value="bat">Bat First</option>
                <option value="bowl">Bowl First</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleTossSubmit}
                disabled={!tossData.tossWinnerId || startMatchMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: (tossData.tossWinnerId && !startMatchMutation.isPending) ? '#22c55e' : '#ccc',
                  color: 'white',
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (tossData.tossWinnerId && !startMatchMutation.isPending) ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {startMatchMutation.isPending ? 'Starting Match...' : 'Start Match'}
              </button>
              <button 
                onClick={() => setIsTossDialogOpen(false)}
                disabled={startMatchMutation.isPending}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: startMatchMutation.isPending ? 'not-allowed' : 'pointer',
                  fontSize: '16px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
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
              {setupMatches.map((match: any) => (
                <Card key={match.id} className="border-2 border-blue-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1?.name || 'Team 1'} vs {match.team2?.name || 'Team 2'}
                      </CardTitle>
                      <Badge className="bg-blue-500">Setup</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <span>•</span>
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Created: {new Date(match.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => handleStartMatch(match)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center font-medium"
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

        {/* Live Matches */}
        {liveMatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-bold text-gray-800">Live Matches</h2>
              <Badge variant="secondary">{liveMatches.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((match: any) => (
                <Card key={match.id} className="border-2 border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1?.name || 'Team 1'} vs {match.team2?.name || 'Team 2'}
                      </CardTitle>
                      <Badge className="bg-green-500">Live</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <span>•</span>
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
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
          </div>
        )}

        {/* Completed Matches */}
        {completedMatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800">Completed Matches</h2>
              <Badge variant="secondary">{completedMatches.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedMatches.map((match: any) => (
                <Card key={match.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1?.name || 'Team 1'} vs {match.team2?.name || 'Team 2'}
                      </CardTitle>
                      <Badge className="bg-gray-500">Completed</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Trophy className="w-4 h-4" />
                        <span>{match.matchType}</span>
                        <span>•</span>
                        <Target className="w-4 h-4" />
                        <span>{match.overs} overs</span>
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