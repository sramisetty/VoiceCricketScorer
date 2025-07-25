import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Clock, Users, BarChart3, TrendingUp, Award } from 'lucide-react';
import type { CompleteMatchData } from '@shared/schema';

interface MatchSummaryProps {
  matchId: number;
}

export function MatchSummary({ matchId }: MatchSummaryProps) {
  const { data: completeMatchData, isLoading, isError } = useQuery<CompleteMatchData>({
    queryKey: ['/api/matches', matchId, 'complete'],
    queryFn: () => fetch(`/api/matches/${matchId}/complete`).then(res => res.json()),
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading match summary...</p>
        </div>
      </div>
    );
  }

  if (isError || !completeMatchData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Unable to load match summary</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { match, innings } = completeMatchData;
  const firstInnings = innings[0];
  const secondInnings = innings[1];

  // Determine match result
  const getMatchResult = () => {
    if (match.status !== 'completed' || !secondInnings) {
      return { winner: null, margin: '', status: 'In Progress' };
    }

    const team1Runs = firstInnings?.totalRuns ?? 0;
    const team2Runs = secondInnings?.totalRuns || 0;
    const team1Wickets = firstInnings?.totalWickets || 0;
    const team2Wickets = secondInnings?.totalWickets || 0;

    if (team1Runs > team2Runs) {
      const margin = team1Runs - team2Runs;
      return {
        winner: firstInnings.battingTeam,
        margin: `${margin} run${margin === 1 ? '' : 's'}`,
        status: 'Completed'
      };
    } else if (team2Runs > team1Runs) {
      const wicketsRemaining = 10 - team2Wickets;
      return {
        winner: secondInnings.battingTeam,
        margin: `${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`,
        status: 'Completed'
      };
    } else {
      return {
        winner: null,
        margin: 'Match tied',
        status: 'Completed'
      };
    }
  };

  const matchResult = getMatchResult();

  // Calculate innings statistics
  const getInningsStats = (inning: typeof firstInnings) => {
    if (!inning) return null;

    const validBalls = inning.balls.filter(ball => 
      !ball.extraType || ball.extraType === 'bye' || ball.extraType === 'legbye'
    );
    const totalOvers = Math.floor(validBalls.length / 6);
    const ballsInCurrentOver = validBalls.length % 6;
    const oversDisplay = ballsInCurrentOver > 0 ? `${totalOvers}.${ballsInCurrentOver}` : `${totalOvers}`;
    
    const runRate = validBalls.length > 0 ? (inning.totalRuns / validBalls.length * 6).toFixed(2) : '0.00';
    
    // Calculate partnerships
    const battingStats = inning.playerStats.filter(p => p.player.teamId === inning.battingTeamId);
    const bowlingStats = inning.playerStats.filter(p => p.player.teamId === inning.bowlingTeamId);
    
    // Top performers
    const topBatsman = battingStats.length > 0 
      ? battingStats.reduce((top, current) => 
          (current.runs || 0) > (top.runs || 0) ? current : top
        )
      : null;
    
    const topBowler = bowlingStats.length > 0 
      ? bowlingStats.reduce((top, current) => 
          (current.wicketsTaken || 0) > (top.wicketsTaken || 0) ? current : top
        )
      : null;

    return {
      totalRuns: inning.totalRuns,
      totalWickets: inning.totalWickets,
      oversDisplay,
      runRate,
      topBatsman,
      topBowler,
      battingStats: battingStats.sort((a, b) => (b.runs || 0) - (a.runs || 0)),
      bowlingStats: bowlingStats.sort((a, b) => (b.wicketsTaken || 0) - (a.wicketsTaken || 0))
    };
  };

  const firstInningsStats = getInningsStats(firstInnings);
  const secondInningsStats = secondInnings ? getInningsStats(secondInnings) : null;

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <CardTitle className="text-2xl">{match.team1.name} vs {match.team2.name}</CardTitle>
                <p className="text-muted-foreground">
                  {match.venue} • {new Date(match.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant={matchResult.status === 'Completed' ? 'default' : 'secondary'}>
              {matchResult.status}
            </Badge>
          </div>
        </CardHeader>
        
        {matchResult.winner && (
          <CardContent>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">
                    {matchResult.winner.name} won by {matchResult.margin}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Match completed successfully
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Innings Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* First Innings */}
        {firstInningsStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                1st Innings - {firstInnings.battingTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {firstInningsStats.totalRuns}/{firstInningsStats.totalWickets}
                </div>
                <div className="text-sm text-muted-foreground">
                  {firstInningsStats.oversDisplay} overs • RR: {firstInningsStats.runRate}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-semibold">Top Performers</h4>
                {firstInningsStats.topBatsman && firstInningsStats.topBatsman.runs > 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{firstInningsStats.topBatsman.player.name}</span>
                    <span className="font-semibold">{firstInningsStats.topBatsman.runs || 0} runs</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">No batting data</span>
                    <span className="font-semibold">-</span>
                  </div>
                )}
                {firstInningsStats.topBowler && firstInningsStats.topBowler.wicketsTaken > 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{firstInningsStats.topBowler.player.name}</span>
                    <span className="font-semibold">{firstInningsStats.topBowler.wicketsTaken || 0} wickets</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">No bowling data</span>
                    <span className="font-semibold">-</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Second Innings */}
        {secondInningsStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                2nd Innings - {secondInnings.battingTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {secondInningsStats.totalRuns}/{secondInningsStats.totalWickets}
                </div>
                <div className="text-sm text-muted-foreground">
                  {secondInningsStats.oversDisplay} overs • RR: {secondInningsStats.runRate}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-semibold">Top Performers</h4>
                {secondInningsStats.topBatsman && secondInningsStats.topBatsman.runs > 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{secondInningsStats.topBatsman.player.name}</span>
                    <span className="font-semibold">{secondInningsStats.topBatsman.runs || 0} runs</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">No batting data</span>
                    <span className="font-semibold">-</span>
                  </div>
                )}
                {secondInningsStats.topBowler && secondInningsStats.topBowler.wicketsTaken > 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{secondInningsStats.topBowler.player.name}</span>
                    <span className="font-semibold">{secondInningsStats.topBowler.wicketsTaken || 0} wickets</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">No bowling data</span>
                    <span className="font-semibold">-</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Detailed Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="batting" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="batting">Batting Performance</TabsTrigger>
              <TabsTrigger value="bowling">Bowling Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="batting" className="space-y-4">
              {innings.map((inning, index) => (
                <div key={inning.id}>
                  <h4 className="font-semibold mb-3">
                    {index + 1}{index === 0 ? 'st' : 'nd'} Innings - {inning.battingTeam.name}
                  </h4>
                  <div className="space-y-2">
                    {inning.playerStats
                      .filter(p => p.player.teamId === inning.battingTeamId)
                      .sort((a, b) => (b.runs || 0) - (a.runs || 0))
                      .map(player => (
                        <div key={player.id} className="flex justify-between items-center py-2 border-b">
                          <div>
                            <span className="font-medium">{player.player.name}</span>
                            {player.isOut && (
                              <Badge variant="secondary" className="ml-2 text-xs">Out</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{player.runs || 0} runs</div>
                            <div className="text-xs text-muted-foreground">
                              {player.ballsFaced || 0} balls • SR: {
                                (player.ballsFaced || 0) > 0 
                                  ? ((player.runs || 0) / (player.ballsFaced || 1) * 100).toFixed(1)
                                  : '0.0'
                              }
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {index === 0 && secondInnings && <Separator className="my-4" />}
                </div>
              ))}
            </TabsContent>
            
            <TabsContent value="bowling" className="space-y-4">
              {innings.map((inning, index) => (
                <div key={inning.id}>
                  <h4 className="font-semibold mb-3">
                    {index + 1}{index === 0 ? 'st' : 'nd'} Innings - {inning.bowlingTeam.name}
                  </h4>
                  <div className="space-y-2">
                    {inning.playerStats
                      .filter(p => p.player.teamId === inning.bowlingTeamId && (p.ballsBowled || 0) > 0)
                      .sort((a, b) => (b.wicketsTaken || 0) - (a.wicketsTaken || 0))
                      .map(player => (
                        <div key={player.id} className="flex justify-between items-center py-2 border-b">
                          <div>
                            <span className="font-medium">{player.player.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{player.wicketsTaken || 0} wickets</div>
                            <div className="text-xs text-muted-foreground">
                              {Math.floor((player.ballsBowled || 0) / 6)}.{(player.ballsBowled || 0) % 6} overs • 
                              Economy: {
                                (player.ballsBowled || 0) > 0 
                                  ? ((player.runsConceded || 0) / (player.ballsBowled || 1) * 6).toFixed(2)
                                  : '0.00'
                              }
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {index === 0 && secondInnings && <Separator className="my-4" />}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}