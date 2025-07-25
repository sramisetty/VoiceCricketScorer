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
  const matches = allMatches.filter((match: any) => match.status === 'completed');

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
      const data = await apiRequest(`/api/matches/${match.id}/complete`);
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Runs</p>
                          <p className="font-semibold">{match.totalRuns || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Wickets</p>
                          <p className="font-semibold">{match.totalWickets || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Overs</p>
                          <p className="font-semibold">{match.totalOvers || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Winner</p>
                          <p className="font-semibold">{match.winner || 'TBD'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {match.status === 'completed' && (
                      <Link href={`/match-details/${match.id}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Full Summary
                        </Button>
                      </Link>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMatch(match)}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Quick Stats
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{match.title}</DialogTitle>
                          <DialogDescription>
                            Detailed match information and statistics
                          </DialogDescription>
                        </DialogHeader>
                        {selectedMatch && (
                          <div className="space-y-6">
                            {/* Match Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg">Match Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Teams:</span>
                                    <span className="font-medium">{selectedMatch.team1?.name} vs {selectedMatch.team2?.name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Date:</span>
                                    <span className="font-medium">{formatDate(selectedMatch.createdAt)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <Badge className={getStatusColor(selectedMatch.status)}>
                                      {selectedMatch.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  {selectedMatch.venue && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Venue:</span>
                                      <span className="font-medium">{selectedMatch.venue}</span>
                                    </div>
                                  )}
                                  {selectedMatch.tossWinner && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Toss Winner:</span>
                                      <span className="font-medium">{selectedMatch.tossWinner.name}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg">Match Statistics</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Runs:</span>
                                    <span className="font-medium">{selectedMatch.totalRuns || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Wickets:</span>
                                    <span className="font-medium">{selectedMatch.totalWickets || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Overs:</span>
                                    <span className="font-medium">{selectedMatch.totalOvers || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Boundaries:</span>
                                    <span className="font-medium">{selectedMatch.totalBoundaries || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Run Rate:</span>
                                    <span className="font-medium">{selectedMatch.runRate || '0.00'}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Commentary Highlights */}
                            {selectedMatch.highlights && selectedMatch.highlights.length > 0 && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg">Match Highlights</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {selectedMatch.highlights.map((highlight: string, index: number) => (
                                      <p key={index} className="text-sm text-gray-700 border-l-2 border-green-500 pl-3">
                                        {highlight}
                                      </p>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMatchData(match)}
                    >
                      <Download className="h-4 w-4 mr-2" />
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
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (pageNum > totalPages) return null;
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          
          <span className="text-sm text-gray-600 ml-4">
            Page {currentPage} of {totalPages} ({sortedMatches.length} matches)
          </span>
        </div>
      )}
    </div>
  );
}