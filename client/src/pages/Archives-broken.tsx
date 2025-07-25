import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Archive, Search, Calendar, Trophy, Users, Clock, Download, Eye, Filter, BarChart3, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

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

  // Fetch complete match data for detailed stats
  const { data: completeMatchData } = useQuery({
    queryKey: ['/api/matches', selectedMatch?.id, 'complete'],
    queryFn: async () => {
      if (!selectedMatch?.id) return null;
      const response = await apiRequest('GET', `/api/matches/${selectedMatch.id}/complete`);
      return response.json();
    },
    enabled: !!selectedMatch?.id,
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
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
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
                          <MatchSummaryContent matchId={match.id} />
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

        {/* Pagination */}
        <div className="flex items-center justify-between mt-8">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredMatches.length)} of {filteredMatches.length} matches
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">{currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to display complete match summary in popup
function MatchSummaryContent({ matchId }: { matchId: number }) {
  const { data: completeData, isLoading } = useQuery({
    queryKey: ['/api/matches', matchId, 'complete'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/matches/${matchId}/complete`);
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading complete match data...</div>;
  }

  if (!completeData) {
    return <div className="p-4 text-center text-red-600">Failed to load match data</div>;
  }

  const { match, innings } = completeData;
  const firstInnings = innings?.[0];
  const secondInnings = innings?.[1];

  return (
    <div className="space-y-6">
      {/* Match Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Match Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{match.team1?.name}</p>
              <p className="text-sm text-gray-600">vs</p>
              <p className="text-2xl font-bold text-red-600">{match.team2?.name}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Total Runs</p>
              <p className="text-2xl font-bold">{(firstInnings?.totalRuns || 0) + (secondInnings?.totalRuns || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Total Wickets</p>
              <p className="text-2xl font-bold">{(firstInnings?.totalWickets || 0) + (secondInnings?.totalWickets || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Status</p>
              <Badge className="text-lg">{match.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Innings Details */}
      {innings && innings.length > 0 && (
        <div className="grid gap-4">
          {innings.map((inning: any, index: number) => (
            <Card key={inning.id}>
              <CardHeader>
                <CardTitle>Innings {inning.inningsNumber} - {inning.battingTeam.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{inning.totalRuns || 0}</p>
                    <p className="text-sm text-gray-600">Runs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{inning.totalWickets || 0}</p>
                    <p className="text-sm text-gray-600">Wickets</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{Math.floor((inning.totalBalls || 0) / 6)}.{(inning.totalBalls || 0) % 6}</p>
                    <p className="text-sm text-gray-600">Overs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{inning.isCompleted ? 'Complete' : 'In Progress'}</p>
                    <p className="text-sm text-gray-600">Status</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Component to display match statistics in popup
function MatchStatsContent({ matchId }: { matchId: number }) {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['/api/matches/stats', matchId],
    queryFn: async () => {
      const response = await fetch(`/api/matches/stats?matchId=${matchId}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading match statistics...</div>;
  }

  if (!statsData) {
    return <div className="p-4 text-center text-red-600">Failed to load statistics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{statsData.totalRuns || 0}</p>
            <p className="text-sm text-gray-600">Total Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{statsData.totalWickets || 0}</p>
            <p className="text-sm text-gray-600">Wickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{statsData.totalBoundaries || 0}</p>
            <p className="text-sm text-gray-600">Boundaries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{statsData.runRate || '0.00'}</p>
            <p className="text-sm text-gray-600">Run Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Match Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Batting Performance</p>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between">
                  <span>Fours:</span>
                  <span className="font-medium">{statsData.fours || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sixes:</span>
                  <span className="font-medium">{statsData.sixes || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Strike Rate:</span>
                  <span className="font-medium">{statsData.strikeRate || '0.00'}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold">Bowling Performance</p>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between">
                  <span>Economy Rate:</span>
                  <span className="font-medium">{statsData.economyRate || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Maiden Overs:</span>
                  <span className="font-medium">{statsData.maidenOvers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extras:</span>
                  <span className="font-medium">{statsData.extras || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}