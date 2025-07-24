import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Trophy, Target, Users, Calendar, Clock, BarChart3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function MatchStats() {
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState('all');

  // Fetch matches for selection
  const { data: matches = [] } = useQuery({
    queryKey: ['/api/matches'],
    queryFn: async () => {
      const response = await fetch('/api/matches');
      if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch match statistics
  const { data: matchStats, isLoading, error } = useQuery({
    queryKey: ['/api/matches/stats', selectedMatch, timeRange],
    queryFn: async () => {
      const url = `/api/matches/stats?matchId=${selectedMatch || ''}&timeRange=${timeRange}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 1,
    staleTime: 30000, // 30 seconds
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading match statistics...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">Error loading match statistics: {error.message}</div>
        </div>
      </div>
    );
  }

  const completedMatches = matches.filter((m: any) => m.status === 'completed');
  const currentMatch = selectedMatch ? matches.find((m: any) => m.id === selectedMatch) : null;

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const runsScoredData = matchStats?.runsPerOver || [];
  const wicketsData = matchStats?.wicketsPerOver || [];
  const boundaryData = matchStats?.boundaryStats || [];
  const bowlerPerformance = matchStats?.bowlerStats || [];
  const batsmanPerformance = matchStats?.batsmanStats || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Match Statistics</h1>
          <p className="text-gray-600">Comprehensive match analytics and performance insights</p>
        </div>
        <div className="flex gap-4">
          <Select 
            value={selectedMatch?.toString() || 'all'} 
            onValueChange={(value) => setSelectedMatch(value === 'all' ? null : parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Matches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Matches</SelectItem>
              {matches.map((match: any) => (
                <SelectItem key={match.id} value={match.id.toString()}>
                  {match.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!matchStats ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No statistics data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchStats?.totalMatches || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {completedMatches.length} completed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchStats?.totalRuns || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: {Math.round((matchStats?.totalRuns || 0) / Math.max(1, matchStats?.totalMatches || 1))} per match
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Wickets</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchStats?.totalWickets || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: {Math.round((matchStats?.totalWickets || 0) / Math.max(1, matchStats?.totalMatches || 1))} per match
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Boundaries</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchStats?.totalBoundaries || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {matchStats?.fours || 0} fours, {matchStats?.sixes || 0} sixes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Current Match Info */}
          {currentMatch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {currentMatch.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Teams</p>
                    <p className="font-semibold">{currentMatch.team1?.name} vs {currentMatch.team2?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={currentMatch.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>
                      {currentMatch.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Innings</p>
                    <p className="font-semibold">Innings {currentMatch.currentInnings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Runs Per Over Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Runs Per Over</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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

            {/* Wickets Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Wickets Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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

            {/* Boundary Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Boundary Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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

            {/* Strike Rate Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Player Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Top Batsmen</h4>
                    {batsmanPerformance.slice(0, 5).map((batsman: any, index: number) => (
                      <div key={batsman.id} className="flex justify-between items-center py-2">
                        <span className="text-sm">{batsman.name}</span>
                        <div className="flex gap-4 text-sm">
                          <span>{batsman.runs} runs</span>
                          <span>SR: {batsman.strikeRate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Top Bowlers</h4>
                    {bowlerPerformance.slice(0, 5).map((bowler: any, index: number) => (
                      <div key={bowler.id} className="flex justify-between items-center py-2">
                        <span className="text-sm">{bowler.name}</span>
                        <div className="flex gap-4 text-sm">
                          <span>{bowler.wickets} wickets</span>
                          <span>Econ: {bowler.economyRate}</span>
                        </div>
                      </div>
                    ))}
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
                      <td className="text-right p-2">{matchStats?.team1Runs || 0}</td>
                      <td className="text-right p-2">{matchStats?.team2Runs || 0}</td>
                      <td className="text-right p-2 font-semibold">{(matchStats?.team1Runs || 0) + (matchStats?.team2Runs || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Wickets Lost</td>
                      <td className="text-right p-2">{matchStats?.team1Wickets || 0}</td>
                      <td className="text-right p-2">{matchStats?.team2Wickets || 0}</td>
                      <td className="text-right p-2 font-semibold">{(matchStats?.team1Wickets || 0) + (matchStats?.team2Wickets || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Boundaries (4s+6s)</td>
                      <td className="text-right p-2">{matchStats?.team1Boundaries || 0}</td>
                      <td className="text-right p-2">{matchStats?.team2Boundaries || 0}</td>
                      <td className="text-right p-2 font-semibold">{(matchStats?.team1Boundaries || 0) + (matchStats?.team2Boundaries || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Run Rate</td>
                      <td className="text-right p-2">{matchStats?.team1RunRate || '0.00'}</td>
                      <td className="text-right p-2">{matchStats?.team2RunRate || '0.00'}</td>
                      <td className="text-right p-2 font-semibold">{matchStats?.overallRunRate || '0.00'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}