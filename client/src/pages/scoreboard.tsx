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
    <div className="mobile-full-height bg-gray-50 dark:bg-gray-900">
      {/* Enhanced Header - Mobile Responsive */}
      <header className="bg-gradient-to-r from-green-700 to-green-800 text-white shadow-xl border-b-4 border-green-600">
        <div className="container mx-auto px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col space-y-3">
            {/* Main Title */}
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white to-green-100 bg-clip-text text-transparent">
                🏏 Live Cricket Scoreboard
              </h1>
              <div className="flex items-center justify-center space-x-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs sm:text-sm font-medium text-green-100">
                  {isConnected ? '🔴 LIVE' : '📡 Offline'}
                </span>
              </div>
            </div>

            {/* Match Info - Compact Mobile Layout */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-center">
                <div className="text-base sm:text-lg lg:text-xl font-bold text-white mb-1">
                  {currentData.match.team1.name} vs {currentData.match.team2.name}
                </div>
                <div className="text-xs sm:text-sm text-green-100 mb-2">
                  {currentData.match.matchType} • {currentData.currentInnings.inningsNumber === 1 ? '1st' : '2nd'} Innings
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
                  <span className="bg-green-600 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                    🏏 {currentData.currentInnings.battingTeam.name} Batting
                  </span>
                  <span className="bg-red-600 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                    ⚾ {currentData.currentInnings.bowlingTeam.name} Bowling
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Share Action */}
            <div className="flex justify-center">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm text-xs sm:text-sm px-3 py-2 h-8 sm:h-9"
                size="sm"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Copy Scoreboard Link</span>
                <span className="sm:hidden">Copy Link</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto scoreboard-mobile">
        {/* Enhanced Main Score Display */}
        <Card className="mb-6 shadow-2xl border-2 border-green-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-green-600 via-green-700 to-green-800 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 right-4 text-6xl">🏏</div>
                <div className="absolute bottom-4 left-4 text-4xl">⚾</div>
              </div>
              
              <div className="relative z-10 p-4 sm:p-6 lg:p-8">
                {/* Score Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-3 text-shadow-lg">
                    📊 LIVE SCORE
                  </h2>
                </div>

                {/* Main Score */}
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-6 border border-white/30">
                  <div className="text-center">
                    <div className="text-5xl sm:text-6xl lg:text-8xl font-black mb-3 text-shadow-xl tracking-wider">
                      {currentData.currentInnings.totalRuns}
                      <span className="text-orange-300 mx-2">/</span>
                      <span className="text-red-300">{currentData.currentInnings.totalWickets}</span>
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-100 mb-2">
                      📏 {currentData.recentBalls.length > 0 ? currentData.recentBalls[0].overNumber : 1}.{currentData.recentBalls.length > 0 ? currentData.recentBalls[0].ballNumber : 0} / {currentData.match.overs}.0 Overs
                    </div>
                    <div className="text-sm sm:text-base lg:text-lg text-green-200">
                      Run Rate: {currentData.currentInnings.totalBalls > 0 ? 
                        ((currentData.currentInnings.totalRuns / currentData.currentInnings.totalBalls) * 6).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>

                {/* Current Over */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold text-green-100 mb-3">
                      📈 Current Over {currentData.recentBalls.length > 0 ? currentData.recentBalls[0].overNumber : 1}
                    </div>
                    <div className="flex justify-center space-x-2 sm:space-x-3">
                      {currentData.recentBalls.slice(0, 6).reverse().map((ball, index) => (
                        <div
                          key={ball.id}
                          className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-sm sm:text-base lg:text-lg font-black border-2 shadow-lg transform transition-all hover:scale-110 ${
                            ball.isWicket 
                              ? 'bg-red-500 border-red-300 text-white animate-pulse' 
                              : ball.runs === 6 
                                ? 'bg-purple-500 border-purple-300 text-white' 
                                : ball.runs === 4 
                                  ? 'bg-blue-500 border-blue-300 text-white' 
                                  : ball.runs > 0 
                                    ? 'bg-green-500 border-green-300 text-white' 
                                    : 'bg-gray-500 border-gray-300 text-white'
                          }`}
                        >
                          {ball.isWicket ? '🔴' : ball.runs === 6 ? '6️⃣' : ball.runs === 4 ? '4️⃣' : ball.runs || '•'}
                        </div>
                      ))}
                      {/* Fill remaining balls */}
                      {Array.from({ length: 6 - currentData.recentBalls.length }).map((_, index) => (
                        <div
                          key={`empty-${index}`}
                          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50"
                        >
                          ⚬
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {/* Enhanced Batting Section */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 sm:p-6 border-2 border-green-200 dark:border-gray-600 shadow-lg">
                <h4 className="font-black text-green-800 dark:text-green-200 mb-4 text-xl flex items-center">
                  🏏 {currentData.currentInnings.battingTeam.name} - Batting
                </h4>
                <div className="space-y-4">
                  {currentBatsmen.length > 0 ? (
                    currentBatsmen.map((batsman) => (
                      <div key={batsman.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        batsman.isOnStrike 
                          ? 'bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300 shadow-lg' 
                          : 'bg-white dark:bg-gray-600 border-gray-200 dark:border-gray-500'
                      }`}>
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                                {batsman.player.name}
                              </span>
                              {batsman.isOnStrike && (
                                <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                                  ⚡ ON STRIKE
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              Strike Rate: <span className="font-semibold">{batsman.ballsFaced > 0 ? ((batsman.runs / batsman.ballsFaced) * 100).toFixed(1) : '0.0'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-2xl text-gray-900 dark:text-gray-100">
                              {batsman.runs}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              ({batsman.ballsFaced} balls)
                            </div>
                            <div className="flex space-x-2 text-xs mt-1">
                              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                {batsman.fours || 0} × 4️⃣
                              </span>
                              <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                                {batsman.sixes || 0} × 6️⃣
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <div className="text-4xl mb-2">🏏</div>
                      <div className="text-lg font-medium">No batsmen at the crease</div>
                      <div className="text-sm">Match not yet started</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Bowling Section */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 sm:p-6 border-2 border-red-200 dark:border-gray-600 shadow-lg">
                <h4 className="font-black text-red-800 dark:text-red-200 mb-4 text-xl flex items-center">
                  ⚾ {currentData.currentInnings.bowlingTeam.name} - Bowling
                </h4>
                <div className="space-y-4">
                  {bowlingStats.length > 0 ? (
                    bowlingStats.slice(0, 3).map((bowler) => (
                      <div key={bowler.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        bowler.playerId === currentData.currentBowler?.playerId 
                          ? 'bg-gradient-to-r from-red-100 to-red-200 border-red-300 shadow-lg' 
                          : 'bg-white dark:bg-gray-600 border-gray-200 dark:border-gray-500'
                      }`}>
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                                {bowler.player.name}
                              </span>
                              {bowler.playerId === currentData.currentBowler?.playerId && (
                                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                                  🎯 BOWLING
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              Economy: <span className="font-semibold">{bowler.ballsBowled > 0 ? ((bowler.runsConceded / bowler.ballsBowled) * 6).toFixed(1) : '0.0'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-2xl text-gray-900 dark:text-gray-100">
                              {bowler.wicketsTaken}/{bowler.runsConceded}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              ({Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6} overs)
                            </div>
                            <div className="text-xs mt-1 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                              {Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6}-0-{bowler.runsConceded}-{bowler.wicketsTaken}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <div className="text-4xl mb-2">⚾</div>
                      <div className="text-lg font-medium">No bowling statistics</div>
                      <div className="text-sm">Match not yet started</div>
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
