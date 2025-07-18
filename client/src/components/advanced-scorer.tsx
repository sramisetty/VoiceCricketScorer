import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  const currentInnings = matchData.currentInnings;
  const battingTeam = currentInnings.battingTeam;
  const bowlingTeam = currentInnings.bowlingTeam;
  const currentBatsmen = matchData.currentBatsmen;
  const currentBowler = matchData.currentBowler;

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
      toast({
        title: "Ball Undone",
        description: "The last ball has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to undo ball.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setRuns(0);
    setExtraType('');
    setExtraRuns(0);
    setWicketType('');
    setIsWicket(false);
  };

  const handleBallSubmit = () => {
    if (!selectedBatsman || !selectedBowler) {
      toast({
        title: "Missing Selection",
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
      extraRuns: extraRuns || 0,
      isWicket: isWicket,
      wicketType: wicketType || null,
      commentary: generateCommentary(runs, isWicket, extraType, wicketType)
    };

    ballMutation.mutate(ballData);
  };

  const generateCommentary = (runs: number, isWicket: boolean, extraType: string, wicketType: string) => {
    if (isWicket) {
      return `${wicketType?.toUpperCase()} - ${currentBatsmen[0]?.player.name} is out!`;
    }
    if (extraType) {
      return `${extraType.toUpperCase()} - ${runs + extraRuns} runs added to the total`;
    }
    if (runs === 0) return "Dot ball - no runs scored";
    if (runs === 4) return "FOUR! Beautiful shot to the boundary";
    if (runs === 6) return "SIX! What a magnificent shot!";
    return `${runs} run${runs > 1 ? 's' : ''} scored`;
  };

  const quickScoreButtons = [
    { label: "0", runs: 0, variant: "outline" as const },
    { label: "1", runs: 1, variant: "outline" as const },
    { label: "2", runs: 2, variant: "outline" as const },
    { label: "3", runs: 3, variant: "outline" as const },
    { label: "4", runs: 4, variant: "default" as const },
    { label: "6", runs: 6, variant: "default" as const },
  ];

  const extraButtons = [
    { label: "Wide", type: "wide", runs: 1 },
    { label: "No Ball", type: "noball", runs: 1 },
    { label: "Bye", type: "bye", runs: 1 },
    { label: "Leg Bye", type: "legbye", runs: 1 },
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
                          {batsman.player.name} ({batsman.runs}*)
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
                      {currentBowler && (
                        <SelectItem value={currentBowler.playerId.toString()}>
                          {currentBowler.player.name} ({currentBowler.oversBowled}-{currentBowler.runsConceded})
                        </SelectItem>
                      )}
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
                      variant={button.variant}
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
                      }}
                    >
                      {wicket.label}
                    </Button>
                  ))}
                </div>
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
                  <Label>Runs</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRuns(Math.max(0, runs - 1))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      value={runs}
                      onChange={(e) => setRuns(parseInt(e.target.value) || 0)}
                      className="text-center"
                      min="0"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRuns(runs + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
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
                <Select value={wicketType} onValueChange={setWicketType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wicket type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Wicket</SelectItem>
                    <SelectItem value="bowled">Bowled</SelectItem>
                    <SelectItem value="caught">Caught</SelectItem>
                    <SelectItem value="lbw">LBW</SelectItem>
                    <SelectItem value="runout">Run Out</SelectItem>
                    <SelectItem value="stumped">Stumped</SelectItem>
                    <SelectItem value="hitwicket">Hit Wicket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleBallSubmit}
                disabled={ballMutation.isPending}
                className="w-full"
                size="lg"
              >
                {ballMutation.isPending ? "Recording..." : "Record Ball"}
              </Button>
            </TabsContent>

            <TabsContent value="extras" className="space-y-4">
              <div className="space-y-3">
                <Label>Extra Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {extraButtons.map((extra) => (
                    <Button
                      key={extra.type}
                      variant={extraType === extra.type ? "default" : "outline"}
                      onClick={() => {
                        setExtraType(extra.type);
                        setExtraRuns(extra.runs);
                        setIsWicket(false);
                      }}
                    >
                      {extra.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Additional Runs</Label>
                <Input
                  type="number"
                  value={extraRuns}
                  onChange={(e) => setExtraRuns(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>

              <Button 
                onClick={handleBallSubmit}
                disabled={ballMutation.isPending}
                className="w-full"
                size="lg"
              >
                {ballMutation.isPending ? "Recording..." : "Record Extra"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}