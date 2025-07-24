import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Play, Eye, Calendar, Clock, Users, Trophy, Target, LogIn, Trash2 } from 'lucide-react';
import type { MatchWithTeams, Team } from '@shared/schema';

export default function Matches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check for stored user data
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Fetch all matches
  const { data: matches = [], isLoading: matchesLoading } = useQuery<MatchWithTeams[]>({
    queryKey: ['/api/matches'],
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Fetch all teams for match creation
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams']
  });

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

  // Check if user can score (admin or scorer only)
  const canScore = user && (user.role === 'admin' || user.role === 'scorer');

  // Delete match mutation
  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const response = await apiRequest('DELETE', `/api/matches/${matchId}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Match deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete match",
        variant: "destructive",
      });
    },
  });

  const handleDeleteMatch = (matchId: number) => {
    if (confirm('Are you sure you want to delete this match? This will permanently remove all match data including scores, stats, and innings. This action cannot be undone.')) {
      deleteMatchMutation.mutate(matchId);
    }
  };

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
            <Link href="/match-setup">
              <Button className="bg-cricket-accent hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                New Match
              </Button>
            </Link>
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
                        <span className="mx-2">|</span>
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
                        {canScore ? (
                          <>
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
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteMatch(match.id)}
                              className="bg-red-500 hover:bg-red-600"
                              disabled={deleteMatchMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Link href={`/scoreboard/${match.id}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              <Eye className="w-4 h-4 mr-2" />
                              View Scoreboard
                            </Button>
                          </Link>
                        )}
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
                        <span className="mx-2">|</span>
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
                        {canScore ? (
                          <>
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
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteMatch(match.id)}
                              className="bg-red-500 hover:bg-red-600"
                              disabled={deleteMatchMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Link href={`/scoreboard/${match.id}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              <Eye className="w-4 h-4 mr-2" />
                              View Scoreboard
                            </Button>
                          </Link>
                        )}
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
                        <span className="mx-2">|</span>
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
                        {canScore && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteMatch(match.id)}
                            className="bg-red-500 hover:bg-red-600"
                            disabled={deleteMatchMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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