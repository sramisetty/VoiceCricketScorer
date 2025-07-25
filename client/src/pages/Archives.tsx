import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { Archive, Search, Calendar, Trophy, Users, Clock, Download, Eye, Filter, BarChart3, FileText, TrendingUp, Target } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { MatchSummary } from '@/components/match-summary';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// Component to fetch and display match summary with proper innings data
function MatchSummaryDisplay({ match }: { match: any }) {
  const { data: completeData } = useQuery({
    queryKey: ['/api/matches', match.id, 'complete'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${match.id}/complete`);
      return response.json();
    },
  });

  if (!completeData) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const { innings } = completeData;
  const firstInnings = innings?.[0];
  const secondInnings = innings?.[1];

  // Calculate match winner
  const getWinner = () => {
    if (!firstInnings || !secondInnings) return 'In Progress';
    
    const team1Runs = firstInnings.totalRuns || 0;
    const team2Runs = secondInnings.totalRuns || 0;
    
    if (team1Runs > team2Runs) {
      return `${firstInnings.battingTeam.name} by ${team1Runs - team2Runs} runs`;
    } else if (team2Runs > team1Runs) {
      const wicketsLeft = 10 - (secondInnings.totalWickets || 0);
      return `${secondInnings.battingTeam.name} by ${wicketsLeft} wickets`;
    } else {
      return 'Match Tied';
    }
  };

  const totalRuns = (firstInnings?.totalRuns || 0) + (secondInnings?.totalRuns || 0);
  const totalWickets = (firstInnings?.totalWickets || 0) + (secondInnings?.totalWickets || 0);
  const totalOvers = Math.max(firstInnings?.totalOvers || 0, secondInnings?.totalOvers || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <p className="text-gray-500">Total Runs</p>
        <p className="font-semibold">{totalRuns}</p>
      </div>
      <div>
        <p className="text-gray-500">Wickets</p>
        <p className="font-semibold">{totalWickets}</p>
      </div>
      <div>
        <p className="text-gray-500">Overs</p>
        <p className="font-semibold">{totalOvers}</p>
      </div>
      <div>
        <p className="text-gray-500">Winner</p>
        <p className="font-semibold text-green-600">{getWinner()}</p>
      </div>
    </div>
  );
}

export default function Archives() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('completed');
  const [sortBy, setSortBy] = useState('date');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch all matches and filter for completed ones
  const { data: allMatches = [], isLoading } = useQuery({
    queryKey: ['/api/matches'],
  });

  // Filter for completed matches only  
  const matches = (allMatches as any[]).filter((match: any) => match.status === 'completed');

  // Filter matches based on search and status
  const filteredMatches = matches.filter((match: any) => {
    const matchesSearch = searchTerm === '' || 
      match.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.team1?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.team2?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || match.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sort matches
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedMatches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMatches = sortedMatches.slice(startIndex, startIndex + itemsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'not_started': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  const exportMatchData = async (match: any) => {
    try {
      const response = await apiRequest('GET', `/api/matches/${match.id}/complete`);
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${match.title.replace(/\s+/g, '_')}_data.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Match Archives</h1>
          <p className="text-gray-600">Browse and analyze historical match data</p>
        </div>
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-500">{sortedMatches.length} archived matches</span>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search matches, teams, or venues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Archives List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading archives...</p>
        </div>
      ) : sortedMatches.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No matches found matching your criteria</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {paginatedMatches.map((match: any) => (
            <Card key={match.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold">{match.title}</h3>
                      <Badge className={getStatusColor(match.status)}>
                        {match.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{match.team1?.name} vs {match.team2?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(match.createdAt)}</span>
                      </div>
                      {match.venue && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{match.venue}</span>
                        </div>
                      )}
                    </div>

                    {/* Match Summary */}
                    {match.status === 'completed' && (
                      <MatchSummaryDisplay match={match} />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Full Summary Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMatch(match)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
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
                        {selectedMatch && selectedMatch.id === match.id && (
                          <MatchSummary matchId={match.id} />
                        )}
                      </DialogContent>
                    </Dialog>

                    {/* Match Stats Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMatch(match)}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Match Stats
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{match.title} - Match Statistics</DialogTitle>
                          <DialogDescription>
                            Detailed statistics, charts, and analytics for this match
                          </DialogDescription>
                        </DialogHeader>
                        {selectedMatch && selectedMatch.id === match.id && (
                          <MatchStatsContent matchId={match.id} />
                        )}
                      </DialogContent>
                    </Dialog>

                    <Button
                      onClick={() => exportMatchData(match)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={filteredMatches.length}
      />
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