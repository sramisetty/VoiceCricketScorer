import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Play, Eye, Trophy, Target, Clock, Users, BarChart3, FileText, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MatchSummary } from '@/components/match-summary';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

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

  // State for match summary dialog
  const [selectedMatchForSummary, setSelectedMatchForSummary] = useState<any>(null);
  
  // State for match stats dialog
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<any>(null);

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
      const response = await apiRequest('POST', `/api/matches/${data.matchId}/start`, {
        tossWinnerId: parseInt(data.tossWinnerId),
        tossDecision: data.tossDecision
      });
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
  const allCompletedMatches = matchList.filter((match: any) => match.status === 'completed');
  // Show only last 3 completed matches on main page
  const completedMatches = allCompletedMatches
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

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
                  className="bg-orange-500 hover:bg-orange-600 text-white"
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
                  <p className="text-gray-500">No live matches</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((match: any) => (
                <Card key={match.id} className="border-2 border-green-200 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {match.team1?.name || 'Team 1'} vs {match.team2?.name || 'Team 2'}
                      </CardTitle>
                      <Badge className="bg-green-500 animate-pulse">Live</Badge>
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
          )}
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



        {/* Completed Matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800">Recent Completed Matches</h2>
              <Badge variant="secondary">{completedMatches.length}</Badge>
            </div>
            {allCompletedMatches.length > 3 && (
              <Link href="/archives">
                <Button variant="outline" size="sm">
                  View All ({allCompletedMatches.length})
                </Button>
              </Link>
            )}
          </div>
          
          {completedMatches.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No completed matches</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedMatches.map((match: any) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow">
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
                      
                      {match.venue && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{match.venue}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Completed: {new Date(match.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                              onClick={() => setSelectedMatchForSummary(match)}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Full Summary
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{match.title} - Complete Match Summary</DialogTitle>
                              <DialogDescription>
                                Comprehensive match details, innings breakdown, and player statistics
                              </DialogDescription>
                            </DialogHeader>
                            {selectedMatchForSummary && selectedMatchForSummary.id === match.id && (
                              <MatchSummary matchId={match.id} />
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline"
                              className="flex-1"
                              onClick={() => setSelectedMatchForStats(match)}
                            >
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Match Stats
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{match.title} - Comprehensive Statistics</DialogTitle>
                              <DialogDescription>
                                Detailed match analytics, charts, and performance insights
                              </DialogDescription>
                            </DialogHeader>
                            {selectedMatchForStats && selectedMatchForStats.id === match.id && (
                              <MatchStatsContent matchId={match.id} />
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component to display comprehensive match statistics in popup
function MatchStatsContent({ matchId }: { matchId: number }) {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['/api/matches/stats', matchId],
    queryFn: async () => {
      const response = await fetch(`/api/matches/stats?matchId=${matchId}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Fetch match info for context
  const { data: matchData } = useQuery({
    queryKey: ['/api/matches', matchId, 'complete'],
    queryFn: async () => {
      const response = await fetch(`/api/matches/${matchId}/complete`);
      if (!response.ok) throw new Error('Failed to fetch match data');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading comprehensive match statistics...</p>
        </div>
      </div>
    );
  }

  if (!statsData) {
    return <div className="p-4 text-center text-red-600">Failed to load comprehensive statistics</div>;
  }

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const runsScoredData = statsData?.runsPerOver || [];
  const wicketsData = statsData?.wicketsPerOver || [];
  const boundaryData = statsData?.boundaryStats || [];
  const bowlerPerformance = statsData?.bowlerStats || [];
  const batsmanPerformance = statsData?.batsmanStats || [];

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.totalRuns || 0}</div>
            <p className="text-xs text-muted-foreground">
              Run Rate: {statsData?.overallRunRate || '0.00'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wickets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.totalWickets || 0}</div>
            <p className="text-xs text-muted-foreground">
              Bowling Average: {statsData?.bowlingAverage || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boundaries</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.totalBoundaries || 0}</div>
            <p className="text-xs text-muted-foreground">
              {statsData?.fours || 0} fours, {statsData?.sixes || 0} sixes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Status</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className="text-sm">{matchData?.match?.status || 'Unknown'}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {matchData?.match?.team1?.name} vs {matchData?.match?.team2?.name}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Runs Per Over Chart */}
        {runsScoredData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Runs Per Over</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={runsScoredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="over" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="runs" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Boundary Analysis */}
        {boundaryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Boundary Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={boundaryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Wickets Distribution */}
        {wicketsData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Wickets Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={wicketsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {wicketsData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Player Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Player Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Top Batsmen</h4>
                {batsmanPerformance.slice(0, 5).map((batsman: any, index: number) => (
                  <div key={batsman.id || index} className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm">{batsman.name}</span>
                    <div className="flex gap-4 text-sm">
                      <span>{batsman.runs || 0} runs</span>
                      <span>SR: {batsman.strikeRate || '0.00'}</span>
                    </div>
                  </div>
                ))}
                {batsmanPerformance.length === 0 && (
                  <p className="text-sm text-muted-foreground">No batting data available</p>
                )}
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Top Bowlers</h4>
                {bowlerPerformance.slice(0, 5).map((bowler: any, index: number) => (
                  <div key={bowler.id || index} className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm">{bowler.name}</span>
                    <div className="flex gap-4 text-sm">
                      <span>{bowler.wickets || 0} wickets</span>
                      <span>Econ: {bowler.economyRate || '0.00'}</span>
                    </div>
                  </div>
                ))}
                {bowlerPerformance.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bowling data available</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Match Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Metric</th>
                  <th className="text-right p-2">Team 1</th>
                  <th className="text-right p-2">Team 2</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Total Runs</td>
                  <td className="text-right p-2">{statsData?.team1Runs || 0}</td>
                  <td className="text-right p-2">{statsData?.team2Runs || 0}</td>
                  <td className="text-right p-2 font-semibold">{(statsData?.team1Runs || 0) + (statsData?.team2Runs || 0)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Wickets Lost</td>
                  <td className="text-right p-2">{statsData?.team1Wickets || 0}</td>
                  <td className="text-right p-2">{statsData?.team2Wickets || 0}</td>
                  <td className="text-right p-2 font-semibold">{(statsData?.team1Wickets || 0) + (statsData?.team2Wickets || 0)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Boundaries (4s+6s)</td>
                  <td className="text-right p-2">{statsData?.team1Boundaries || 0}</td>
                  <td className="text-right p-2">{statsData?.team2Boundaries || 0}</td>
                  <td className="text-right p-2 font-semibold">{(statsData?.team1Boundaries || 0) + (statsData?.team2Boundaries || 0)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Run Rate</td>
                  <td className="text-right p-2">{statsData?.team1RunRate || '0.00'}</td>
                  <td className="text-right p-2">{statsData?.team2RunRate || '0.00'}</td>
                  <td className="text-right p-2 font-semibold">{statsData?.overallRunRate || '0.00'}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Extras</td>
                  <td className="text-right p-2">{statsData?.team1Extras || 0}</td>
                  <td className="text-right p-2">{statsData?.team2Extras || 0}</td>
                  <td className="text-right p-2 font-semibold">{(statsData?.team1Extras || 0) + (statsData?.team2Extras || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Additional Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Batting Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Fours Hit:</span>
                <span className="font-medium">{statsData?.fours || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Sixes Hit:</span>
                <span className="font-medium">{statsData?.sixes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Strike Rate:</span>
                <span className="font-medium">{statsData?.strikeRate || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Boundary %:</span>
                <span className="font-medium">{statsData?.boundaryPercentage || '0.00'}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bowling Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Economy Rate:</span>
                <span className="font-medium">{statsData?.economyRate || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Maiden Overs:</span>
                <span className="font-medium">{statsData?.maidenOvers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Wides Bowled:</span>
                <span className="font-medium">{statsData?.wides || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>No Balls:</span>
                <span className="font-medium">{statsData?.noBalls || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

