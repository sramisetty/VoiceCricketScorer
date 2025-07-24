import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line } from 'recharts';
import { Trophy, Target, Users, Search, TrendingUp, Activity, Star, Award, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function PlayerStats() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [sortBy, setSortBy] = useState('runs');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // Fetch players with stats
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['/api/player-statistics', searchTerm, selectedTeam, selectedRole],
  });

  // Fetch teams for filter
  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
  });

  // Fetch detailed player stats when selected
  const { data: playerDetails } = useQuery({
    queryKey: ['/api/players', selectedPlayer?.id, 'detailed-stats'],
    enabled: !!selectedPlayer,
  });

  // Filter and sort players
  const filteredPlayers = players.filter((player: any) => {
    const matchesSearch = searchTerm === '' || 
      player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = selectedTeam === 'all' || player.teamId?.toString() === selectedTeam;
    const matchesRole = selectedRole === 'all' || player.role === selectedRole;
    
    return matchesSearch && matchesTeam && matchesRole;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    switch (sortBy) {
      case 'runs':
        return (b.stats?.totalRuns || 0) - (a.stats?.totalRuns || 0);
      case 'wickets':
        return (b.stats?.totalWickets || 0) - (a.stats?.totalWickets || 0);
      case 'matches':
        return (b.stats?.totalMatches || 0) - (a.stats?.totalMatches || 0);
      case 'average':
        return (b.stats?.battingAverage || 0) - (a.stats?.battingAverage || 0);
      case 'strikeRate':
        return (b.stats?.strikeRate || 0) - (a.stats?.strikeRate || 0);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'batsman': return 'bg-blue-500';
      case 'bowler': return 'bg-red-500';
      case 'allrounder': return 'bg-green-500';
      case 'wicketkeeper': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatStat = (value: number | undefined, decimals = 0) => {
    return value ? value.toFixed(decimals) : '0';
  };

  const performanceData = selectedPlayer && playerDetails ? [
    { subject: 'Runs', A: Math.min(100, (playerDetails.stats?.totalRuns || 0) / 10) },
    { subject: 'Strike Rate', A: Math.min(100, (playerDetails.stats?.strikeRate || 0)) },
    { subject: 'Average', A: Math.min(100, (playerDetails.stats?.battingAverage || 0) * 2) },
    { subject: 'Consistency', A: Math.min(100, (playerDetails.stats?.consistency || 0)) },
    { subject: 'Boundaries', A: Math.min(100, (playerDetails.stats?.boundaries || 0) / 2) },
    { subject: 'Form', A: Math.min(100, (playerDetails.stats?.recentForm || 0) * 20) },
  ] : [];

  const matchPerformance = playerDetails?.matchHistory || [];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Player Statistics</h1>
          <p className="text-gray-600">Comprehensive player performance analytics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-500">{sortedPlayers.length} players</span>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team: any) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="batsman">Batsman</SelectItem>
                <SelectItem value="bowler">Bowler</SelectItem>
                <SelectItem value="allrounder">All-rounder</SelectItem>
                <SelectItem value="wicketkeeper">Wicket Keeper</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="runs">Runs</SelectItem>
                <SelectItem value="wickets">Wickets</SelectItem>
                <SelectItem value="matches">Matches</SelectItem>
                <SelectItem value="average">Average</SelectItem>
                <SelectItem value="strikeRate">Strike Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Players List */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading player statistics...</p>
            </div>
          ) : sortedPlayers.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No players found matching your criteria</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedPlayers.map((player: any) => (
                <Card key={player.id} className={`cursor-pointer hover:shadow-lg transition-all ${selectedPlayer?.id === player.id ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardContent className="p-4" onClick={() => setSelectedPlayer(player)}>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                          {getInitials(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{player.name}</h3>
                          <Badge className={getRoleColor(player.role)}>
                            {player.role}
                          </Badge>
                          {player.stats?.totalMatches > 50 && (
                            <Star className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {player.team?.name || 'No team assigned'}
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Matches</p>
                            <p className="font-semibold">{player.stats?.totalMatches || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Runs</p>
                            <p className="font-semibold">{player.stats?.totalRuns || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Average</p>
                            <p className="font-semibold">{formatStat(player.stats?.battingAverage, 2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Strike Rate</p>
                            <p className="font-semibold">{formatStat(player.stats?.strikeRate, 2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Wickets</p>
                            <p className="font-semibold">{player.stats?.totalWickets || 0}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-semibold">{player.stats?.trophies || 0}</span>
                          </div>
                          <div className="w-16">
                            <p className="text-xs text-gray-500 mb-1">Form</p>
                            <Progress value={(player.stats?.recentForm || 0) * 20} className="h-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Player Details Panel */}
        <div className="space-y-6">
          {selectedPlayer ? (
            <>
              {/* Player Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                        {getInitials(selectedPlayer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">{selectedPlayer.name}</p>
                      <p className="text-sm text-gray-600">{selectedPlayer.team?.name}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Role:</span>
                      <Badge className={getRoleColor(selectedPlayer.role)}>
                        {selectedPlayer.role}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Batting Order:</span>
                      <span className="font-semibold">{selectedPlayer.battingOrder || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge className={selectedPlayer.availability ? 'bg-green-500' : 'bg-red-500'}>
                        {selectedPlayer.availability ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Radar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance Radar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={performanceData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                      <Radar name="Performance" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Career Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Career Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{selectedPlayer.stats?.totalRuns || 0}</p>
                        <p className="text-sm text-gray-600">Total Runs</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{selectedPlayer.stats?.totalWickets || 0}</p>
                        <p className="text-sm text-gray-600">Wickets</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Highest Score:</span>
                        <span className="font-semibold">{selectedPlayer.stats?.highestScore || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Bowling:</span>
                        <span className="font-semibold">{selectedPlayer.stats?.bestBowling || '0/0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Boundaries:</span>
                        <span className="font-semibold">{selectedPlayer.stats?.boundaries || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Economy Rate:</span>
                        <span className="font-semibold">{formatStat(selectedPlayer.stats?.economyRate, 2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Recent Form
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={matchPerformance.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="match" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="runs" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedPlayer.stats?.totalMatches >= 50 && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                        <Trophy className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">Veteran Player (50+ matches)</span>
                      </div>
                    )}
                    {selectedPlayer.stats?.highestScore >= 100 && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                        <Star className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Century Maker</span>
                      </div>
                    )}
                    {selectedPlayer.stats?.totalWickets >= 50 && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                        <Zap className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Strike Bowler (50+ wickets)</span>
                      </div>
                    )}
                    {(!selectedPlayer.stats?.totalMatches || selectedPlayer.stats.totalMatches < 10) && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Play more matches to unlock achievements!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Select a player to view detailed statistics</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}