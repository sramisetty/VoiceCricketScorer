import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, Clock, Users, BarChart3 } from 'lucide-react';
import type { LiveMatchData } from '@shared/schema';

interface MatchStatisticsProps {
  matchData: LiveMatchData;
}

export function MatchStatistics({ matchData }: MatchStatisticsProps) {
  const currentInnings = matchData.currentInnings;
  const battingTeam = currentInnings.battingTeam;
  const bowlingTeam = currentInnings.bowlingTeam;
  const currentBatsmen = matchData.currentBatsmen;
  const currentBowler = matchData.currentBowler;
  const recentBalls = matchData.recentBalls;

  // Calculate statistics using database values (not mathematical calculations)
  const totalRuns = currentInnings.totalRuns;
  const totalWickets = currentInnings.totalWickets;
  const totalBalls = currentInnings.totalBalls;
  
  // Calculate current over display logic - same as scorer page
  const getCurrentOverInfo = () => {
    if (!recentBalls?.length) return { display: "0.0", overNumber: 1, validBalls: 0 };
    
    const lastBall = recentBalls[0];
    const lastOverNumber = lastBall.overNumber;
    
    // Get all balls in the last over that was bowled
    const lastOverBalls = recentBalls.filter(ball => ball.overNumber === lastOverNumber);
    const validBallsInLastOver = lastOverBalls.filter(ball => 
      !ball.extraType || ball.extraType === 'bye' || ball.extraType === 'legbye'
    ).length;
    
    // If the last over is complete (6 valid balls), show completed overs count
    if (validBallsInLastOver >= 6) {
      return { 
        display: `${lastOverNumber}.0`, 
        overNumber: lastOverNumber + 1,
        validBalls: 0
      };
    }
    
    // Otherwise show current over with balls bowled
    return { 
      display: `${lastOverNumber}.${validBallsInLastOver}`, 
      overNumber: lastOverNumber,
      validBalls: validBallsInLastOver
    };
  };

  const currentOverInfo = getCurrentOverInfo();
  const currentOverNumber = currentOverInfo.overNumber;
  const ballsInCurrentOver = currentOverInfo.validBalls;
  
  const totalOvers = Math.max(0, currentOverNumber - 1); // Previous completed overs
  const runRate = totalBalls > 0 ? (totalRuns / totalBalls * 6).toFixed(2) : '0.00';
  
  // Calculate batting statistics
  const battingStats = currentBatsmen.map(batsman => {
    const strikeRate = batsman.ballsFaced > 0 ? (batsman.runs / batsman.ballsFaced * 100).toFixed(1) : '0.0';
    return {
      ...batsman,
      strikeRate: parseFloat(strikeRate)
    };
  });

  // Calculate bowling statistics
  const bowlingStats = currentBowler ? {
    ...currentBowler,
    economy: currentBowler.ballsBowled > 0 ? (currentBowler.runsConceded / currentBowler.ballsBowled * 6).toFixed(2) : '0.00'
  } : null;

  // Calculate recent over statistics for current innings only
  const currentInningsId = currentInnings.id;
  const currentInningsBalls = recentBalls.filter(ball => ball.inningsId === currentInningsId);
  const lastOver = currentInningsBalls.slice(0, 6);
  const overRuns = lastOver.reduce((total, ball) => total + ball.runs + (ball.extraRuns || 0), 0);
  const overWickets = lastOver.filter(ball => ball.isWicket).length;

  // Calculate partnership
  const partnership = battingStats.reduce((total, batsman) => total + batsman.runs, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Match Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="batting">Batting</TabsTrigger>
              <TabsTrigger value="bowling">Bowling</TabsTrigger>
              <TabsTrigger value="partnership">Partnership</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{totalRuns}</div>
                  <div className="text-sm text-muted-foreground">Total Runs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">{totalWickets}</div>
                  <div className="text-sm text-muted-foreground">Wickets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalOvers}.{ballsInCurrentOver}</div>
                  <div className="text-sm text-muted-foreground">Overs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{runRate}</div>
                  <div className="text-sm text-muted-foreground">Run Rate</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Match Progress</span>
                  <span className="text-sm text-muted-foreground">{totalBalls}/300 balls</span>
                </div>
                <Progress value={(totalBalls / 300) * 100} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Last Over</div>
                        <div className="text-lg font-bold">{overRuns} runs</div>
                      </div>
                      <Badge variant={overWickets > 0 ? "destructive" : overRuns > 10 ? "default" : "secondary"}>
                        {overWickets > 0 ? `${overWickets}W` : `${overRuns}R`}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Required Rate</div>
                        <div className="text-lg font-bold">8.50</div>
                      </div>
                      <Badge variant="outline">
                        <Target className="w-3 h-3 mr-1" />
                        Target
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="batting" className="space-y-4">
              <div className="space-y-4">
                {battingStats.map((batsman, index) => (
                  <Card key={batsman.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{batsman.player.name}</div>
                            <div className="text-sm text-muted-foreground">{batsman.player.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">{batsman.runs}*</div>
                          <div className="text-sm text-muted-foreground">
                            {batsman.ballsFaced} balls
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm font-medium">{batsman.fours}</div>
                          <div className="text-xs text-muted-foreground">Fours</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{batsman.sixes}</div>
                          <div className="text-xs text-muted-foreground">Sixes</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{batsman.strikeRate}</div>
                          <div className="text-xs text-muted-foreground">Strike Rate</div>
                        </div>
                        <div>
                          <Badge variant={batsman.strikeRate > 120 ? "default" : batsman.strikeRate > 80 ? "secondary" : "destructive"}>
                            {batsman.strikeRate > 120 ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : batsman.strikeRate < 80 ? (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            ) : null}
                            {batsman.strikeRate > 120 ? "Excellent" : batsman.strikeRate > 80 ? "Good" : "Slow"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bowling" className="space-y-4">
              {bowlingStats && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-bold">
                          B
                        </div>
                        <div>
                          <div className="font-medium">{bowlingStats.player.name}</div>
                          <div className="text-sm text-muted-foreground">{bowlingStats.player.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{bowlingStats.wicketsTaken}/{bowlingStats.runsConceded}</div>
                        <div className="text-sm text-muted-foreground">
                          {bowlingStats.oversBowled} overs
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-sm font-medium">{bowlingStats.economy}</div>
                        <div className="text-xs text-muted-foreground">Economy</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{bowlingStats.wicketsTaken}</div>
                        <div className="text-xs text-muted-foreground">Wickets</div>
                      </div>
                      <div>
                        <Badge variant={parseFloat(bowlingStats.economy) < 6 ? "default" : parseFloat(bowlingStats.economy) < 8 ? "secondary" : "destructive"}>
                          {parseFloat(bowlingStats.economy) < 6 ? "Economical" : parseFloat(bowlingStats.economy) < 8 ? "Good" : "Expensive"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="partnership" className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium">Current Partnership</div>
                        <div className="text-sm text-muted-foreground">
                          {battingStats.map(b => b.player.name).join(' & ')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{partnership}</div>
                      <div className="text-sm text-muted-foreground">runs</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    {battingStats.map((batsman, index) => (
                      <div key={batsman.id} className="flex items-center justify-between">
                        <span className="text-sm">{batsman.player.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{batsman.runs}</span>
                          <div className="w-20 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{width: `${(batsman.runs / partnership) * 100}%`}}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {partnership > 0 ? Math.round((batsman.runs / partnership) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}