import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import type { LiveMatchData } from '@shared/schema';

export default function Scoreboard() {
  const [, params] = useRoute('/scoreboard/:matchId');
  const { toast } = useToast();
  
  const matchId = params?.matchId ? parseInt(params.matchId) : null;
  const { liveData, isConnected } = useWebSocket(matchId);

  // Fetch initial match data
  const { data: matchData, isLoading, error } = useQuery<LiveMatchData>({
    queryKey: ['/api/matches', matchId, 'live'],
    enabled: !!matchId,
    refetchInterval: isConnected ? false : 5000,
  });

  const currentData = liveData || matchData;

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied",
        description: "Scoreboard link has been copied to clipboard.",
      });
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cricket-primary" />
          <div className="text-xl font-semibold text-gray-700">Loading live scoreboard...</div>
        </div>
      </div>
    );
  }

  if (error || !currentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Match Not Found</h1>
              <p className="text-gray-600">
                The requested match could not be found or is not yet started.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentBatsmen = currentData.currentBatsmen;
  const bowlingStats = currentData.currentInnings.playerStats.filter(s => s.ballsBowled > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-cricket-primary to-cricket-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Live Cricket Scoreboard</h1>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                <span className="text-base sm:text-lg opacity-90">
                  {currentData.match.team1.name} vs {currentData.match.team2.name}
                </span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-sm opacity-75">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Main Score Display */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="pt-6">
            <div className="bg-gradient-to-r from-cricket-primary to-cricket-secondary text-white p-4 sm:p-6 rounded-lg mb-6">
              <div className="text-center">
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                  {currentData.currentInnings.battingTeam.name} vs {currentData.currentInnings.bowlingTeam.name}
                </h3>
                <p className="text-sm sm:text-base lg:text-xl opacity-90">
                  {currentData.match.matchType} Match • {currentData.currentInnings.inningsNumber === 1 ? '1st' : '2nd'} Innings
                </p>
              </div>
              <div className="flex justify-center items-center mt-4 sm:mt-6">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl lg:text-6xl font-bold">
                    {currentData.currentInnings.totalRuns}/{currentData.currentInnings.totalWickets}
                  </div>
                  <div className="text-sm sm:text-base lg:text-xl opacity-90">
                    {Math.floor(currentData.currentInnings.totalBalls / 6)}.{currentData.currentInnings.totalBalls % 6} / {currentData.match.overs}.0 Overs
                  </div>
                </div>
              </div>

              {/* Current Over */}
              <div className="mt-4 sm:mt-6 text-center">
                <div className="text-sm sm:text-base lg:text-lg mb-2">Current Over</div>
                <div className="flex justify-center space-x-1 sm:space-x-2">
                  {currentData.recentBalls.slice(0, 6).reverse().map((ball, index) => (
                    <div
                      key={ball.id}
                      className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold"
                    >
                      {ball.isWicket ? 'W' : ball.runs}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {/* Batting */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-lg">
                  {currentData.currentInnings.battingTeam.name} - Batting
                </h4>
                <div className="space-y-3">
                  {currentBatsmen.length > 0 ? (
                    currentBatsmen.map((batsman) => (
                      <div key={batsman.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-md">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {batsman.player.name}{batsman.isOnStrike ? '*' : ''}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            SR: {batsman.ballsFaced > 0 ? ((batsman.runs / batsman.ballsFaced) * 100).toFixed(1) : '0.0'}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {batsman.runs} ({batsman.ballsFaced})
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {batsman.fours || 0}×4 {batsman.sixes || 0}×6
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      No batsmen currently at the crease
                    </div>
                  )}
                </div>
              </div>

              {/* Bowling */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-lg">
                  {currentData.currentInnings.bowlingTeam.name} - Bowling
                </h4>
                <div className="space-y-3">
                  {bowlingStats.length > 0 ? (
                    bowlingStats.slice(0, 3).map((bowler) => (
                      <div key={bowler.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-md">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {bowler.player.name}
                            {bowler.playerId === currentData.currentBowler?.playerId && '*'}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Economy: {bowler.ballsBowled > 0 ? ((bowler.runsConceded / bowler.ballsBowled) * 6).toFixed(1) : '0.0'}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6}-0-{bowler.runsConceded}-{bowler.wicketsTaken}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            O-M-R-W
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      No bowling statistics available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Match Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-cricket-light to-cricket-primary/10 rounded-lg border">
                <div className="text-xl sm:text-2xl font-bold text-cricket-primary">
                  {currentData.currentInnings.totalBalls > 0 ? ((currentData.currentInnings.totalRuns * 6) / currentData.currentInnings.totalBalls).toFixed(1) : '0.0'}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Run Rate</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">
                  {currentData.recentBalls.filter(b => b.runs === 4).length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Fours</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">
                  {currentData.recentBalls.filter(b => b.runs === 6).length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Sixes</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">
                  {currentData.recentBalls.filter(b => b.extraType).length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Extras</div>
              </div>
            </div>

            {/* Share Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
              <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Share This Scoreboard</h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Input 
                  value={window.location.href}
                  readOnly 
                  className="flex-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
                <Button
                  onClick={handleCopyLink}
                  className="bg-cricket-primary hover:bg-cricket-secondary text-white whitespace-nowrap"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Commentary */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Recent Commentary</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-cricket">
              {currentData.recentBalls.length > 0 ? (
                currentData.recentBalls.slice(0, 10).map((ball) => (
                  <div key={ball.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="bg-cricket-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {ball.overNumber}.{ball.ballNumber}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 dark:text-gray-200 font-medium">
                        {ball.bowler.name} to {ball.batsman.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        {ball.commentary || `${ball.runs} run${ball.runs !== 1 ? 's' : ''} scored`}
                        {ball.isWicket && (
                          <span className="ml-2 text-red-600 font-medium">WICKET!</span>
                        )}
                        {ball.extraType && (
                          <span className="ml-2 text-orange-600 font-medium">({ball.extraType})</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-bold ${ball.isWicket ? 'text-red-600' : ball.runs >= 4 ? 'text-green-600' : 'text-gray-800 dark:text-gray-200'}`}>
                        {ball.isWicket ? 'W' : ball.runs}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p>No commentary available yet</p>
                  <p className="text-sm mt-2">Commentary will appear as the match progresses</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
