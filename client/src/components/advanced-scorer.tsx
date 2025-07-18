import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { LiveMatchData } from '@shared/schema';
import { Undo, RotateCcw, UserX, ArrowRightLeft, Plus, Minus } from 'lucide-react';

interface AdvancedScorerProps {
  matchData: LiveMatchData;
  matchId: number;
}

export function AdvancedScorer({ matchData, matchId }: AdvancedScorerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatsman, setSelectedBatsman] = useState<number | null>(null);
  const [selectedBowler, setSelectedBowler] = useState<number | null>(null);
  const [runs, setRuns] = useState(0);
  const [extraType, setExtraType] = useState<string>('');
  const [extraRuns, setExtraRuns] = useState(0);
  const [wicketType, setWicketType] = useState<string>('');
  const [isWicket, setIsWicket] = useState(false);
  const [fielderId, setFielderId] = useState<number | null>(null);

  const currentInnings = matchData.currentInnings;
  const battingTeam = currentInnings.battingTeam;
  const bowlingTeam = currentInnings.bowlingTeam;
  const currentBatsmen = matchData.currentBatsmen;
  const currentBowler = matchData.currentBowler;

  // Set default selections - always select the on-strike batsman
  useEffect(() => {
    if (currentBatsmen.length > 0) {
      // Find the on-strike batsman and select them by default
      const onStrikeBatsman = currentBatsmen.find(b => b.isOnStrike);
      if (onStrikeBatsman) {
        setSelectedBatsman(onStrikeBatsman.playerId);
      } else {
        // Fallback to first batsman if no one is marked as on strike
        setSelectedBatsman(currentBatsmen[0].playerId);
      }
    }
    if (currentBowler && !selectedBowler) {
      setSelectedBowler(currentBowler.playerId);
    }
  }, [currentBatsmen, currentBowler]);

  const ballMutation = useMutation({
    mutationFn: async (ballData: any) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/ball`, ballData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
      resetForm();
      toast({
        title: "Ball Recorded",
        description: "The ball has been successfully recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record ball. Please try again.",
        variant: "destructive",
      });
    }
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/undo`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
      resetForm();
      toast({
        title: "Ball Undone",
        description: "The last ball has been successfully undone.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to undo ball. Please try again.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setRuns(0);
    setExtraType('');
    setExtraRuns(0);
    setIsWicket(false);
    setWicketType('');
    setFielderId(null);
  };

  const handleBallSubmit = async () => {
    if (!selectedBatsman || !selectedBowler) {
      toast({
        title: "Error",
        description: "Please select both batsman and bowler.",
        variant: "destructive",
      });
      return;
    }

    const ballData = {
      inningsId: currentInnings.id,
      overNumber: Math.floor(currentInnings.totalBalls / 6) + 1,
      ballNumber: (currentInnings.totalBalls % 6) + 1,
      batsmanId: selectedBatsman,
      bowlerId: selectedBowler,
      runs: runs,
      extraType: extraType || null,
      extraRuns: extraRuns,
      isWicket: isWicket,
      wicketType: isWicket ? wicketType : null,
      fielderId: isWicket && fielderId ? fielderId : null,
      commentary: generateCommentary(),
    };

    ballMutation.mutate(ballData);
  };

  const generateCommentary = () => {
    let commentary = '';
    if (isWicket) {
      const batsmanName = currentBatsmen.find(b => b.playerId === selectedBatsman)?.player.name;
      let fielderInfo = '';
      
      if (fielderId) {
        // Find fielder from bowling team players
        const bowlingTeamPlayers = currentInnings.playerStats.filter(
          stat => stat.player.teamId === bowlingTeam.id
        );
        const fielder = bowlingTeamPlayers.find(p => p.playerId === fielderId);
        
        if (fielder) {
          if (wicketType === 'caught') {
            fielderInfo = ` c ${fielder.player.name}`;
          } else if (wicketType === 'runout') {
            fielderInfo = ` (run out by ${fielder.player.name})`;
          } else if (wicketType === 'stumped') {
            fielderInfo = ` st ${fielder.player.name}`;
          }
        }
      }
      
      commentary = `${wicketType}${fielderInfo} - ${batsmanName} is out`;
    } else if (extraType) {
      commentary = `${extraType} - ${runs + extraRuns} runs`;
    } else {
      commentary = `${runs} run${runs !== 1 ? 's' : ''}`;
    }
    return commentary;
  };

  const quickScoreButtons = [
    { label: "0", runs: 0, variant: "outline" as const },
    { label: "1", runs: 1, variant: "outline" as const },
    { label: "2", runs: 2, variant: "outline" as const },
    { label: "3", runs: 3, variant: "outline" as const },
    { label: "4", runs: 4, variant: "secondary" as const },
    { label: "6", runs: 6, variant: "secondary" as const },
  ];

  const extraButtons = [
    { label: "Wide", type: "wide" },
    { label: "No Ball", type: "noball" },
    { label: "Bye", type: "bye" },
    { label: "Leg Bye", type: "legbye" },
  ];

  const wicketButtons = [
    { label: "Bowled", type: "bowled" },
    { label: "Caught", type: "caught" },
    { label: "LBW", type: "lbw" },
    { label: "Run Out", type: "runout" },
    { label: "Stumped", type: "stumped" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Advanced Scorer</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => undoMutation.mutate()}
                disabled={undoMutation.isPending}
              >
                <Undo className="w-4 h-4 mr-1" />
                Undo
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quick" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick">Quick Score</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
              <TabsTrigger value="extras">Extras</TabsTrigger>
            </TabsList>
            
            <TabsContent value="quick" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Current Batsman</Label>
                  <Select value={selectedBatsman?.toString()} onValueChange={(value) => setSelectedBatsman(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batsman" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentBatsmen.map((batsman) => (
                        <SelectItem key={batsman.id} value={batsman.playerId.toString()}>
                          {batsman.player.name} ({batsman.runs}*) {batsman.isOnStrike ? '🏏 ON STRIKE' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Current Bowler</Label>
                  <Select value={selectedBowler?.toString()} onValueChange={(value) => setSelectedBowler(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bowler" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentInnings.playerStats
                        .filter(stat => stat.player.teamId === bowlingTeam.id)
                        .map((bowler) => {
                          const balls = bowler.ballsBowled ?? 0;
                          const overs = Math.floor(balls / 6);
                          const remainingBalls = balls % 6;
                          const overDisplay = remainingBalls > 0 ? `${overs}.${remainingBalls}` : `${overs}`;
                          const runs = bowler.runsConceded ?? 0;
                          const wickets = bowler.wicketsTaken ?? 0;
                          const isCurrentBowler = bowler.playerId === currentBowler?.playerId;
                          return (
                            <SelectItem key={bowler.playerId} value={bowler.playerId.toString()}>
                              {bowler.player.name} ({overDisplay}-{runs}-{wickets}) {isCurrentBowler ? '🏏 BOWLING' : ''}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Runs Scored</Label>
                <div className="grid grid-cols-6 gap-2">
                  {quickScoreButtons.map((button) => (
                    <Button
                      key={button.label}
                      variant={runs === button.runs && !isWicket && !extraType ? "default" : button.variant}
                      size="lg"
                      onClick={() => {
                        setRuns(button.runs);
                        setIsWicket(false);
                        setExtraType('');
                      }}
                      className="h-12"
                    >
                      {button.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Wickets</Label>
                <div className="grid grid-cols-3 gap-2">
                  {wicketButtons.map((wicket) => (
                    <Button
                      key={wicket.type}
                      variant={isWicket && wicketType === wicket.type ? "default" : "outline"}
                      onClick={() => {
                        setIsWicket(true);
                        setWicketType(wicket.type);
                        // Reset fielder when wicket type changes
                        setFielderId(null);
                      }}
                    >
                      {wicket.label}
                    </Button>
                  ))}
                </div>
                
                {/* Show fielder selection for wickets that involve a fielder */}
                {isWicket && (wicketType === 'caught' || wicketType === 'runout' || wicketType === 'stumped') && (
                  <div>
                    <Label>
                      {wicketType === 'caught' ? 'Caught by' : 
                       wicketType === 'runout' ? 'Run out by' : 
                       'Stumped by'}
                    </Label>
                    <Select value={fielderId?.toString() || ''} onValueChange={(value) => setFielderId(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select fielder`} />
                      </SelectTrigger>
                      <SelectContent>
                        {currentInnings.playerStats
                          .filter(stat => stat.player.teamId === bowlingTeam.id)
                          .map((player) => (
                            <SelectItem key={player.playerId} value={player.playerId.toString()}>
                              {player.player.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              <Button 
                onClick={handleBallSubmit}
                disabled={ballMutation.isPending}
                className="w-full"
                size="lg"
              >
                {ballMutation.isPending ? "Recording..." : "Record Ball"}
              </Button>
            </TabsContent>

            <TabsContent value="detailed" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Batsman</Label>
                  <Select value={selectedBatsman?.toString()} onValueChange={(value) => setSelectedBatsman(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batsman" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentBatsmen.map((batsman) => (
                        <SelectItem key={batsman.id} value={batsman.playerId.toString()}>
                          {batsman.player.name} ({batsman.runs}*) {batsman.isOnStrike ? '🏏 ON STRIKE' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Bowler</Label>
                  <Select value={selectedBowler?.toString()} onValueChange={(value) => setSelectedBowler(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bowler" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentInnings.playerStats
                        .filter(stat => stat.player.teamId === bowlingTeam.id)
                        .map((bowler) => {
                          const balls = bowler.ballsBowled ?? 0;
                          const overs = Math.floor(balls / 6);
                          const remainingBalls = balls % 6;
                          const overDisplay = remainingBalls > 0 ? `${overs}.${remainingBalls}` : `${overs}`;
                          const runs = bowler.runsConceded ?? 0;
                          const wickets = bowler.wicketsTaken ?? 0;
                          const isCurrentBowler = bowler.playerId === currentBowler?.playerId;
                          return (
                            <SelectItem key={bowler.playerId} value={bowler.playerId.toString()}>
                              {bowler.player.name} ({overDisplay}-{runs}-{wickets}) {isCurrentBowler ? '🏏 BOWLING' : ''}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Runs</Label>
                  <Input
                    type="number"
                    value={runs}
                    onChange={(e) => setRuns(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                
                <div>
                  <Label>Extra Runs</Label>
                  <Input
                    type="number"
                    value={extraRuns}
                    onChange={(e) => setExtraRuns(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label>Wicket Type</Label>
                <Select value={wicketType} onValueChange={(value) => {
                  setWicketType(value);
                  setIsWicket(!!value);
                  // Reset fielder when wicket type changes
                  setFielderId(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wicket type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No wicket</SelectItem>
                    {wicketButtons.map((wicket) => (
                      <SelectItem key={wicket.type} value={wicket.type}>
                        {wicket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show fielder selection for wickets that involve a fielder */}
              {isWicket && (wicketType === 'caught' || wicketType === 'runout' || wicketType === 'stumped') && (
                <div>
                  <Label>
                    {wicketType === 'caught' ? 'Caught by' : 
                     wicketType === 'runout' ? 'Run out by' : 
                     'Stumped by'}
                  </Label>
                  <Select value={fielderId?.toString() || ''} onValueChange={(value) => setFielderId(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select fielder`} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentInnings.playerStats
                        .filter(stat => stat.player.teamId === bowlingTeam.id)
                        .map((player) => (
                          <SelectItem key={player.playerId} value={player.playerId.toString()}>
                            {player.player.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                onClick={handleBallSubmit}
                disabled={ballMutation.isPending}
                className="w-full"
              >
                {ballMutation.isPending ? "Recording..." : "Record Ball"}
              </Button>
            </TabsContent>

            <TabsContent value="extras" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Batsman</Label>
                  <Select value={selectedBatsman?.toString()} onValueChange={(value) => setSelectedBatsman(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batsman" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentBatsmen.map((batsman) => (
                        <SelectItem key={batsman.id} value={batsman.playerId.toString()}>
                          {batsman.player.name} ({batsman.runs}*) {batsman.isOnStrike ? '🏏 ON STRIKE' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Bowler</Label>
                  <Select value={selectedBowler?.toString()} onValueChange={(value) => setSelectedBowler(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bowler" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentInnings.playerStats
                        .filter(stat => stat.player.teamId === bowlingTeam.id)
                        .map((bowler) => {
                          const balls = bowler.ballsBowled ?? 0;
                          const overs = Math.floor(balls / 6);
                          const remainingBalls = balls % 6;
                          const overDisplay = remainingBalls > 0 ? `${overs}.${remainingBalls}` : `${overs}`;
                          const runs = bowler.runsConceded ?? 0;
                          const wickets = bowler.wicketsTaken ?? 0;
                          const isCurrentBowler = bowler.playerId === currentBowler?.playerId;
                          return (
                            <SelectItem key={bowler.playerId} value={bowler.playerId.toString()}>
                              {bowler.player.name} ({overDisplay}-{runs}-{wickets}) {isCurrentBowler ? '🏏 BOWLING' : ''}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Extra Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {extraButtons.map((extra) => (
                    <Button
                      key={extra.type}
                      variant={extraType === extra.type ? "default" : "outline"}
                      onClick={() => setExtraType(extra.type)}
                    >
                      {extra.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Runs Off Bat</Label>
                  <Input
                    type="number"
                    value={runs}
                    onChange={(e) => setRuns(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                
                <div>
                  <Label>Extra Runs</Label>
                  <Input
                    type="number"
                    value={extraRuns}
                    onChange={(e) => setExtraRuns(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>

              <Button 
                onClick={handleBallSubmit}
                disabled={ballMutation.isPending}
                className="w-full"
              >
                {ballMutation.isPending ? "Recording..." : "Record Ball"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}