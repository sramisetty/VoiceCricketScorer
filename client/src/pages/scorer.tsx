import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Share, Download, Settings, Pause, Play, Clock, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { VoiceInput } from '@/components/voice-input';
import { ManualOverride } from '@/components/manual-override';
import { Commentary } from '@/components/commentary';
import { CurrentOver } from '@/components/current-over';
import { TeamStats } from '@/components/team-stats';
import { BowlingFigures } from '@/components/bowling-figures';
import { AdvancedScorer } from '@/components/advanced-scorer';
import { MatchStatistics } from '@/components/match-statistics';
import { apiRequest } from '@/lib/queryClient';
import { generateCommentary, type ParsedCommand } from '@/lib/cricket-parser';
import type { LiveMatchData } from '@shared/schema';

export default function Scorer() {
  const [, params] = useRoute('/scorer/:matchId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const matchId = params?.matchId ? parseInt(params.matchId) : null;
  const { liveData, isConnected } = useWebSocket(matchId);
  const [isMatchStarted, setIsMatchStarted] = useState(false);
  const [changeBowlerDialogOpen, setChangeBowlerDialogOpen] = useState(false);
  const [timeoutDialogOpen, setTimeoutDialogOpen] = useState(false);
  const [selectedNewBowler, setSelectedNewBowler] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState(5);
  const [overCompletedDialogOpen, setOverCompletedDialogOpen] = useState(false);
  const [nextBowlerId, setNextBowlerId] = useState('');
  const [openersDialogOpen, setOpenersDialogOpen] = useState(false);
  const [selectedOpener1, setSelectedOpener1] = useState('');
  const [selectedOpener2, setSelectedOpener2] = useState('');
  const [selectedStriker, setSelectedStriker] = useState('');

  // Fetch initial match data
  const { data: matchData, isLoading, error } = useQuery<LiveMatchData>({
    queryKey: ['/api/matches', matchId, 'live'],
    enabled: !!matchId,
    refetchInterval: isConnected ? false : 5000, // Only poll if websocket not connected
  });

  const currentData = liveData || matchData;

  // Fetch available bowlers (bowling team players)
  const { data: availableBowlers = [] } = useQuery({
    queryKey: ['/api/teams', currentData?.currentInnings.bowlingTeam.id, 'players'],
    enabled: !!currentData?.currentInnings.bowlingTeam.id,
  });

  // Fetch available batsmen (batting team players)
  const { data: availableBatsmen = [] } = useQuery({
    queryKey: ['/api/teams', currentData?.currentInnings.battingTeam.id, 'players'],
    enabled: !!currentData?.currentInnings.battingTeam.id,
  });

  useEffect(() => {
    if (currentData?.match.status === 'live') {
      setIsMatchStarted(true);
    }
  }, [currentData]);

  // Check if over is completed and prompt for next bowler
  useEffect(() => {
    if (currentData?.currentInnings) {
      const ballsInCurrentOver = currentData.currentInnings.totalBalls % 6;
      const isOverCompleted = ballsInCurrentOver === 0 && currentData.currentInnings.totalBalls > 0;
      
      if (isOverCompleted && !overCompletedDialogOpen) {
        setOverCompletedDialogOpen(true);
      }
    }
  }, [currentData?.currentInnings.totalBalls, overCompletedDialogOpen]);

  // Check if no balls have been bowled and prompt for opener selection
  useEffect(() => {
    if (currentData?.currentInnings && currentData.currentInnings.totalBalls === 0 && isMatchStarted) {
      // Only show dialog if no batsmen are currently on strike (openers not set)
      const hasOnStrikeBatsman = currentData.currentBatsmen.some(batsman => batsman.isOnStrike);
      if (!hasOnStrikeBatsman && !openersDialogOpen) {
        setOpenersDialogOpen(true);
      }
    }
  }, [currentData?.currentInnings.totalBalls, currentData?.currentBatsmen, isMatchStarted, openersDialogOpen]);

  const startMatchMutation = useMutation({
    mutationFn: async () => {
      if (!currentData) return;
      
      const battingTeamId = currentData.match.tossDecision === 'bat' 
        ? currentData.match.tossWinnerId 
        : currentData.match.tossWinnerId === currentData.match.team1Id
          ? currentData.match.team2Id
          : currentData.match.team1Id;

      const bowlingTeamId = battingTeamId === currentData.match.team1Id 
        ? currentData.match.team2Id 
        : currentData.match.team1Id;

      const response = await apiRequest('POST', `/api/matches/${matchId}/start`, {
        battingTeamId,
        bowlingTeamId
      });
      return response.json();
    },
    onSuccess: () => {
      setIsMatchStarted(true);
      toast({
        title: "Match Started",
        description: "The cricket match has begun. You can now start voice scoring.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start match. Please try again.",
        variant: "destructive",
      });
    }
  });

  const addBallMutation = useMutation({
    mutationFn: async (command: ParsedCommand) => {
      if (!currentData) return;

      const currentBatsmen = currentData.currentBatsmen;
      const currentBowler = currentData.currentBowler;
      const striker = currentBatsmen.find(b => b.isOnStrike) || currentBatsmen[0];
      
      if (!striker || !currentBowler) {
        throw new Error('No current batsman or bowler found');
      }

      const lastBall = currentData.recentBalls[0];
      const overNumber = lastBall ? lastBall.overNumber : 1;
      const ballNumber = lastBall && lastBall.overNumber === overNumber 
        ? lastBall.ballNumber + 1 
        : 1;

      const commentary = generateCommentary(
        command, 
        striker.player.name, 
        currentBowler.player.name
      );

      const ballData = {
        inningsId: currentData.currentInnings.id,
        overNumber,
        ballNumber,
        batsmanId: striker.playerId,
        bowlerId: currentBowler.playerId,
        runs: command.runs || 0,
        isWicket: command.isWicket || false,
        wicketType: command.wicketType,
        extraType: command.extraType,
        extraRuns: command.extraRuns || 0,
        commentary
      };

      const response = await apiRequest('POST', `/api/matches/${matchId}/ball`, ballData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add ball. Please try again.",
        variant: "destructive",
      });
    }
  });

  const undoBallMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/undo`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ball Undone",
        description: "The last ball has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to undo ball. Please try again.",
        variant: "destructive",
      });
    }
  });

  const changeBowlerMutation = useMutation({
    mutationFn: async (newBowlerId: string) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/change-bowler`, {
        newBowlerId: parseInt(newBowlerId)
      });
      return response.json();
    },
    onSuccess: () => {
      // Close dialogs immediately
      setChangeBowlerDialogOpen(false);
      setSelectedNewBowler('');
      setOverCompletedDialogOpen(false);
      setNextBowlerId('');
      
      // Show success message
      toast({
        title: "Bowler Changed",
        description: "The bowler has been changed successfully.",
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to change bowler. Please try again.",
        variant: "destructive",
      });
    }
  });

  const setOpenersMutation = useMutation({
    mutationFn: async (openerData: { opener1Id: string, opener2Id: string, strikerId: string }) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/set-openers`, {
        opener1Id: parseInt(openerData.opener1Id),
        opener2Id: parseInt(openerData.opener2Id),
        strikerId: parseInt(openerData.strikerId)
      });
      return response.json();
    },
    onSuccess: () => {
      // Close dialog immediately
      setOpenersDialogOpen(false);
      setSelectedOpener1('');
      setSelectedOpener2('');
      setSelectedStriker('');
      
      // Show success message
      toast({
        title: "Openers Set",
        description: "The opening batsmen have been set successfully.",
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set openers. Please try again.",
        variant: "destructive",
      });
    }
  });

  const timeoutMutation = useMutation({
    mutationFn: async (duration: number) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/timeout`, {
        duration
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Timeout Called",
        description: `Match paused for ${timeoutDuration} minutes.`,
      });
      setTimeoutDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to call timeout. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCommand = (command: ParsedCommand) => {
    if (!isMatchStarted) {
      toast({
        title: "Match Not Started",
        description: "Please start the match before adding balls.",
        variant: "destructive",
      });
      return;
    }

    if (command.type === 'correction') {
      undoBallMutation.mutate();
    } else if (command.type === 'runs' || command.type === 'wicket' || command.type === 'extra') {
      addBallMutation.mutate(command);
    }
  };

  const handleShareScoreboard = () => {
    const url = `${window.location.origin}/scoreboard/${matchId}`;
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
          <div className="text-xl font-semibold text-gray-700">Loading match...</div>
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
              <p className="text-gray-600 mb-4">
                The requested match could not be found or loaded.
              </p>
              <Button onClick={() => setLocation('/')}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentBatsmen = currentData.currentBatsmen;
  const striker = currentBatsmen.find(b => b.isOnStrike);
  const nonStriker = currentBatsmen.find(b => !b.isOnStrike);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-cricket-primary text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <h1 className="text-xl font-bold">Cricket Voice Scorer</h1>
              {!isConnected && (
                <span className="text-sm bg-red-500 px-2 py-1 rounded">Offline</span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleShareScoreboard}
                className="bg-cricket-accent hover:bg-orange-600"
              >
                <Share className="h-4 w-4 mr-2" />
                Share Scoreboard
              </Button>
              <Button className="bg-cricket-secondary hover:bg-green-900">
                <Download className="h-4 w-4 mr-2" />
                Export Match
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Match Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div className="mb-4 md:mb-0">
                <h2 className="text-2xl font-bold text-gray-800">
                  {currentData.match.team1.name} vs {currentData.match.team2.name}
                </h2>
                <p className="text-gray-600">
                  {currentData.match.matchType} Match • Over {Math.floor(currentData.currentInnings.totalBalls / 6)}.{currentData.currentInnings.totalBalls % 6} of {currentData.match.overs}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-3xl font-bold text-cricket-primary">
                    {currentData.currentInnings.totalRuns}/{currentData.currentInnings.totalWickets}
                  </div>
                  <div className="text-sm text-gray-600">
                    {Math.floor(currentData.currentInnings.totalBalls / 6)}.{currentData.currentInnings.totalBalls % 6} Overs
                  </div>
                </div>
                {!isMatchStarted && (
                  <Button
                    onClick={() => startMatchMutation.mutate()}
                    disabled={startMatchMutation.isPending}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {startMatchMutation.isPending ? 'Starting...' : 'Start Match'}
                  </Button>
                )}
              </div>
            </div>

            {/* Current Players */}
            {isMatchStarted && currentBatsmen.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                {striker && (
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-cricket-accent rounded-full"></div>
                    <div>
                      <div className="font-semibold text-gray-800">
                        {striker.player.name}* ({striker.runs})
                      </div>
                      <div className="text-sm text-gray-600">
                        {striker.ballsFaced} balls • {striker.fours} fours • {striker.sixes} sixes
                      </div>
                    </div>
                  </div>
                )}
                {nonStriker && (
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <div>
                      <div className="font-semibold text-gray-800">
                        {nonStriker.player.name} ({nonStriker.runs})
                      </div>
                      <div className="text-sm text-gray-600">
                        {nonStriker.ballsFaced} balls • {nonStriker.fours} fours
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voice Input Panel */}
          <div className="lg:col-span-2 space-y-6">
            <VoiceInput
              onCommand={handleCommand}
              currentBatsman={striker?.player.name}
              currentBowler={currentData.currentBowler?.player.name}
            />

            <AdvancedScorer 
              matchData={currentData}
              matchId={matchId!}
            />

            <MatchStatistics matchData={currentData} />

            <Commentary balls={currentData.recentBalls} matchId={matchId!} />
          </div>

          {/* Live Scoreboard */}
          <div className="space-y-6">
            <CurrentOver
              balls={currentData.currentInnings.balls}
              bowlerName={currentData.currentBowler?.player.name || 'Unknown'}
              overNumber={Math.floor(currentData.currentInnings.totalBalls / 6) + 1}
            />

            <TeamStats
              innings={currentData.currentInnings}
              targetRuns={undefined} // TODO: Add target for 2nd innings
              targetOvers={currentData.match.overs}
            />

            <BowlingFigures
              bowlingStats={currentData.currentInnings.playerStats.filter(s => s.ballsBowled > 0)}
              currentBowlerId={currentData.currentBowler?.playerId}
            />

            {/* Quick Actions */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {/* Change Bowler Dialog */}
                  <Dialog open={changeBowlerDialogOpen} onOpenChange={setChangeBowlerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full bg-cricket-primary hover:bg-cricket-secondary text-white"
                        disabled={!isMatchStarted}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Change Bowler
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Change Bowler</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="current-bowler">Current Bowler</Label>
                          <div className="p-2 bg-gray-50 rounded text-sm">
                            {currentData?.currentBowler?.player.name || 'No bowler selected'}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="new-bowler">New Bowler</Label>
                          <Select value={selectedNewBowler} onValueChange={setSelectedNewBowler}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select new bowler" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBowlers.map((player: any) => (
                                <SelectItem key={player.id} value={player.id.toString()}>
                                  {player.name} ({player.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button
                            onClick={() => changeBowlerMutation.mutate(selectedNewBowler)}
                            disabled={!selectedNewBowler || changeBowlerMutation.isPending}
                            className="flex-1"
                          >
                            {changeBowlerMutation.isPending ? 'Changing...' : 'Change Bowler'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setChangeBowlerDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Timeout Dialog */}
                  <Dialog open={timeoutDialogOpen} onOpenChange={setTimeoutDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline" 
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={!isMatchStarted}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Timeout
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Call Timeout</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="timeout-duration">Duration (minutes)</Label>
                          <Input
                            type="number"
                            value={timeoutDuration}
                            onChange={(e) => setTimeoutDuration(parseInt(e.target.value) || 5)}
                            min="1"
                            max="15"
                            placeholder="5"
                          />
                        </div>
                        <div className="text-sm text-gray-600">
                          The match will be paused for {timeoutDuration} minutes.
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button
                            onClick={() => timeoutMutation.mutate(timeoutDuration)}
                            disabled={timeoutMutation.isPending}
                            className="flex-1"
                          >
                            {timeoutMutation.isPending ? 'Calling...' : 'Call Timeout'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setTimeoutDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Change Batsmen Button */}
                  <Button
                    variant="outline"
                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => {
                      // Pre-populate current batsmen when changing
                      if (currentData?.currentBatsmen?.length >= 2) {
                        const striker = currentData.currentBatsmen.find(b => b.isOnStrike);
                        const nonStriker = currentData.currentBatsmen.find(b => !b.isOnStrike);
                        
                        if (striker && nonStriker) {
                          setSelectedOpener1(striker.playerId.toString());
                          setSelectedOpener2(nonStriker.playerId.toString());
                          setSelectedStriker(striker.playerId.toString());
                        }
                      }
                      setOpenersDialogOpen(true);
                    }}
                    disabled={!isMatchStarted}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Change Batsmen
                  </Button>

                  {/* Match Settings */}
                  <Button
                    variant="outline"
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white"
                    onClick={() => setLocation(`/match-settings/${matchId}`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Match Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Over Completed Dialog */}
      <Dialog open={overCompletedDialogOpen} onOpenChange={setOverCompletedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Over Completed - Select Next Bowler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The over has been completed. Please select the bowler for the next over.
            </p>
            <div>
              <Label htmlFor="next-bowler">Next Bowler</Label>
              <Select value={nextBowlerId} onValueChange={setNextBowlerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select next bowler" />
                </SelectTrigger>
                <SelectContent>
                  {availableBowlers
                    .filter(bowler => bowler.id !== currentData?.currentBowler?.playerId)
                    .map((bowler) => (
                      <SelectItem key={bowler.id} value={bowler.id.toString()}>
                        {bowler.name} ({bowler.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOverCompletedDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => changeBowlerMutation.mutate(nextBowlerId)}
                disabled={!nextBowlerId || changeBowlerMutation.isPending}
              >
                <User className="w-4 h-4 mr-2" />
                {changeBowlerMutation.isPending ? 'Changing...' : 'Change Bowler'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Openers Selection Dialog */}
      <Dialog open={openersDialogOpen} onOpenChange={setOpenersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentData?.currentInnings?.totalBalls === 0 ? 'Select Opening Batsmen' : 'Change Batsmen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {currentData?.currentInnings?.totalBalls === 0 
                ? 'Please select the two opening batsmen and who will face the first ball.'
                : 'Select the two batsmen currently at the crease and who is on strike.'}
            </p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="opener1">First Opener</Label>
                <Select value={selectedOpener1} onValueChange={setSelectedOpener1}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select first opener" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBatsmen.map((batsman) => (
                      <SelectItem key={batsman.id} value={batsman.id.toString()}>
                        {batsman.name} ({batsman.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="opener2">Second Opener</Label>
                <Select value={selectedOpener2} onValueChange={setSelectedOpener2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select second opener" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBatsmen
                      .filter(batsman => batsman.id.toString() !== selectedOpener1)
                      .map((batsman) => (
                        <SelectItem key={batsman.id} value={batsman.id.toString()}>
                          {batsman.name} ({batsman.role})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="striker">Who will face the first ball?</Label>
                <Select value={selectedStriker} onValueChange={setSelectedStriker}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select striker" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedOpener1 && (
                      <SelectItem value={selectedOpener1}>
                        {availableBatsmen.find(b => b.id.toString() === selectedOpener1)?.name} (ON STRIKE)
                      </SelectItem>
                    )}
                    {selectedOpener2 && (
                      <SelectItem value={selectedOpener2}>
                        {availableBatsmen.find(b => b.id.toString() === selectedOpener2)?.name} (ON STRIKE)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpenersDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => setOpenersMutation.mutate({
                  opener1Id: selectedOpener1,
                  opener2Id: selectedOpener2,
                  strikerId: selectedStriker
                })}
                disabled={!selectedOpener1 || !selectedOpener2 || !selectedStriker || setOpenersMutation.isPending}
              >
                <User className="w-4 h-4 mr-2" />
                {setOpenersMutation.isPending ? 'Setting...' : 
                  (currentData?.currentInnings?.totalBalls === 0 ? 'Set Openers' : 'Change Batsmen')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
