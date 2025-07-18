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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-cricket-primary to-cricket-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Live Cricket Scoreboard</h1>
              <div className="flex items-center space-x-4">
                <span className="text-lg opacity-90">
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
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="bg-gradient-to-r from-cricket-primary to-cricket-secondary text-white p-6 rounded-lg mb-6">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {currentData.match.team1.name} vs {currentData.match.team2.name}
                </h3>
                <p className="text-xl opacity-90">
                  {currentData.match.matchType} Match • {currentData.currentInnings.inningsNumber === 1 ? '1st' : '2nd'} Innings
                </p>
              </div>
              <div className="flex justify-center items-center mt-6">
                <div className="text-center">
                  <div className="text-6xl font-bold">
                    {currentData.currentInnings.totalRuns}/{currentData.currentInnings.totalWickets}
                  </div>
                  <div className="text-xl opacity-90">
                    {Math.floor(currentData.currentInnings.totalBalls / 6)}.{currentData.currentInnings.totalBalls % 6} / {currentData.match.overs}.0 Overs
                  </div>
                </div>
              </div>

              {/* Current Over */}
              <div className="mt-6 text-center">
                <div className="text-lg mb-2">Current Over</div>
                <div className="flex justify-center space-x-2">
                  {currentData.recentBalls.slice(0, 6).reverse().map((ball, index) => (
                    <div
                      key={ball.id}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold"
                    >
                      {ball.isWicket ? 'W' : ball.runs}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Batting */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 mb-3">
                  {currentData.currentInnings.battingTeam.name} - Batting
                </h4>
                <div className="space-y-2">
                  {currentBatsmen.map((batsman) => (
                    <div key={batsman.id} className="flex justify-between items-center">
                      <span className="font-medium">
                        {batsman.player.name}{batsman.isOnStrike ? '*' : ''}
                      </span>
                      <span>
                        {batsman.runs} ({batsman.ballsFaced})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bowling */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 mb-3">
                  {currentData.currentInnings.bowlingTeam.name} - Bowling
                </h4>
                <div className="space-y-2">
                  {bowlingStats.slice(0, 3).map((bowler) => (
                    <div key={bowler.id} className="flex justify-between items-center">
                      <span className="font-medium">
                        {bowler.player.name}
                        {bowler.playerId === currentData.currentBowler?.playerId && '*'}
                      </span>
                      <span>
                        {Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6}-0-{bowler.runsConceded}-{bowler.wicketsTaken}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Match Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-cricket-primary">
                  {((currentData.currentInnings.totalRuns * 6) / currentData.currentInnings.totalBalls || 0).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Run Rate</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-cricket-primary">
                  {currentData.recentBalls.filter(b => b.runs === 4).length}
                </div>
                <div className="text-sm text-gray-600">Fours</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-cricket-primary">
                  {currentData.recentBalls.filter(b => b.runs === 6).length}
                </div>
                <div className="text-sm text-gray-600">Sixes</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-cricket-primary">
                  {currentData.recentBalls.filter(b => b.extraType).length}
                </div>
                <div className="text-sm text-gray-600">Extras</div>
              </div>
            </div>

            {/* Share Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">Share This Scoreboard</h4>
              <div className="flex items-center space-x-4">
                <Input 
                  value={window.location.href}
                  readOnly 
                  className="flex-1 bg-white"
                />
                <Button
                  onClick={handleCopyLink}
                  className="bg-cricket-primary hover:bg-cricket-secondary text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Commentary */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Commentary</h3>
            <div className="space-y-3">
              {currentData.recentBalls.slice(0, 5).map((ball) => (
                <div key={ball.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="bg-cricket-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {ball.overNumber}.{ball.ballNumber}
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">
                      {ball.bowler.name} to {ball.batsman.name}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {ball.commentary || `${ball.runs} run${ball.runs !== 1 ? 's' : ''} scored`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
