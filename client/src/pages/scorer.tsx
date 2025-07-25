import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Share, Download, Settings, Pause, Play, Clock, User, Users, Undo, Trash, ArrowLeftRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { VoiceInput } from '@/components/voice-input';
import { WhisperVoiceInput } from '@/components/whisper-voice-input';
import { EnhancedVoiceInput } from '@/components/enhanced-voice-input';
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
  // Temporarily disable WebSocket due to connection issues - use REST API polling instead
  const liveData = null;
  const isConnected = true; // Show as connected since REST API polling is working
  const [isMatchStarted, setIsMatchStarted] = useState(false);
  const [changeBowlerDialogOpen, setChangeBowlerDialogOpen] = useState(false);
  const [timeoutDialogOpen, setTimeoutDialogOpen] = useState(false);
  const [selectedNewBowler, setSelectedNewBowler] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState(5);
  const [overCompletedDialogOpen, setOverCompletedDialogOpen] = useState(false);
  const [nextBowlerId, setNextBowlerId] = useState('');
  const [openersDialogOpen, setOpenersDialogOpen] = useState(false);
  const [openersSetComplete, setOpenersSetComplete] = useState(false);
  const [lastBowlerChangeTime, setLastBowlerChangeTime] = useState(0);
  const [selectedOpener1, setSelectedOpener1] = useState('');
  const [selectedOpener2, setSelectedOpener2] = useState('');
  const [selectedStriker, setSelectedStriker] = useState('');
  const [newBatsmanDialogOpen, setNewBatsmanDialogOpen] = useState(false);
  const [selectedNewBatsman, setSelectedNewBatsman] = useState('');
  const [outBatsmanName, setOutBatsmanName] = useState('');
  const [isAddingBall, setIsAddingBall] = useState(false);
  const [tossDialogOpen, setTossDialogOpen] = useState(false);
  const [tossWinner, setTossWinner] = useState('');
  const [endInningsDialogOpen, setEndInningsDialogOpen] = useState(false);
  const [tossDecision, setTossDecision] = useState('');
  const [activeTab, setActiveTab] = useState('live');

  // Fetch initial match data
  const { data: matchData, isLoading: liveDataLoading, error } = useQuery<LiveMatchData>({
    queryKey: ['/api/matches', matchId, 'live'],
    enabled: !!matchId,
    refetchInterval: 3000, // Poll every 3 seconds since WebSocket is disabled
    refetchOnWindowFocus: true,
    retry: false, // Don't retry failed requests
  });

  // Fetch basic match info if live data fails
  const { data: basicMatchData, isLoading: basicDataLoading } = useQuery({
    queryKey: ['/api/matches', matchId],
    enabled: !!matchId && !matchData && !liveDataLoading,
    retry: false,
  });

  // Proper loading state management
  const isLoading = liveDataLoading || basicDataLoading;

  const currentData = liveData || matchData;
  
  // Error handling for failed API calls
  if (error && !matchData && !basicMatchData) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Match</h2>
          <p className="text-gray-600 mb-4">Please check your connection and try again.</p>
          <p className="text-sm text-gray-500">The match data might be temporarily unavailable.</p>
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId] });
              window.location.reload();
            }}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

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
    
    // Reset openers complete flag when innings changes
    if (currentData?.currentInnings) {
      setOpenersSetComplete(false);
    }
  }, [currentData?.match.status, currentData?.currentInnings.id]);





  // Check for wickets and prompt for new batsman selection
  useEffect(() => {
    if (currentData?.currentInnings && currentData.currentBatsmen.length > 0) {
      // Check if any batsman is out and we need a replacement
      const outBatsmen = currentData.currentInnings.playerStats.filter(
        stat => stat.isOut && stat.player.teamId === currentData.currentInnings.battingTeam.id
      );
      
      // If we have less than 2 active batsmen and there are out batsmen, show dialog
      const activeBatsmen = currentData.currentBatsmen.filter(batsman => !batsman.isOut);
      
      if (activeBatsmen.length < 2 && outBatsmen.length > 0 && !newBatsmanDialogOpen) {
        const lastOutBatsman = outBatsmen[outBatsmen.length - 1]; // Most recent out batsman
        setOutBatsmanName(lastOutBatsman.player.name);
        setNewBatsmanDialogOpen(true);
      }
    }
  }, [currentData?.currentInnings.playerStats, currentData?.currentBatsmen, newBatsmanDialogOpen]);

  // Handle innings completion notifications
  useEffect(() => {
    if (currentData?.currentInnings && currentData.match) {
      const totalOvers = currentData.match.overs;
      const totalWickets = currentData.currentInnings.totalWickets ?? 0;
      const currentBalls = currentData.currentInnings.totalBalls ?? 0;
      const isInningsComplete = totalWickets >= 10 || currentBalls >= (totalOvers * 6);
      
      // Show notifications for innings completion
      if (isInningsComplete && currentData.currentInnings.isCompleted) {
        if (currentData.currentInnings.inningsNumber === 1 && currentData.match.currentInnings === 2) {
          toast({
            title: "First Innings Complete!",
            description: `${currentData.currentInnings.battingTeam.name} scored ${currentData.currentInnings.totalRuns}/${currentData.currentInnings.totalWickets}. Second innings starting...`,
            duration: 10000,
          });
        } else if (currentData.currentInnings.inningsNumber === 2 && currentData.match.status === 'completed') {
          toast({
            title: "Match Complete!",
            description: "Both innings have been completed. Check match results for final details.",
            duration: 10000,
          });
        }
      }
    }
  }, [currentData?.currentInnings.isCompleted, currentData?.match.currentInnings, currentData?.match.status]);

  const startMatchMutation = useMutation({
    mutationFn: async ({ tossWinnerId, tossDecision }: { tossWinnerId: number, tossDecision: string }) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/start`, {
        tossWinnerId,
        tossDecision
      });
      return response.json();
    },
    onSuccess: () => {
      setIsMatchStarted(true);
      setTossDialogOpen(false);
      toast({
        title: "Match Started",
        description: "The cricket match has begun with toss completed. You can now start voice scoring.",
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

  const handleStartMatch = () => {
    setTossDialogOpen(true);
  };

  const handleTossSubmit = () => {
    if (!tossWinner || !tossDecision) {
      toast({
        title: "Missing Information",
        description: "Please select both toss winner and their decision.",
        variant: "destructive",
      });
      return;
    }

    startMatchMutation.mutate({
      tossWinnerId: parseInt(tossWinner),
      tossDecision
    });
  };

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
        isWicket: false, // Wickets are now handled through the advanced scorer only
        extraType: command.extraType,
        extraRuns: command.extraRuns || 0,
        commentary
      };

      const response = await apiRequest('POST', `/api/matches/${matchId}/ball`, ballData);
      return response.json();
    },
    onSuccess: () => {
      setIsAddingBall(false);
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: (error: any) => {
      setIsAddingBall(false);
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

  const clearMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/clear`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Match Cleared",
        description: "All balls and runs have been cleared. Match reset to initial state.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
      setIsMatchStarted(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear match data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const switchStrikeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/switch-strike`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Strike Switched",
        description: `${data.newStriker} is now on strike (was ${data.previousStriker})`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch strike. Please try again.",
        variant: "destructive",
      });
    }
  });

  const endInningsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/end-innings`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Innings Ended",
        description: data.message || "Current innings has been ended successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end innings. Please try again.",
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
      console.log('Bowler change successful - closing all dialogs');
      
      // Set timestamp to prevent dialog from re-triggering immediately
      setLastBowlerChangeTime(Date.now());
      
      // Force close all bowler-related dialogs
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
      
      // Small delay to ensure state updates
      setTimeout(() => {
        setOverCompletedDialogOpen(false);
        setChangeBowlerDialogOpen(false);
      }, 100);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to change bowler. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Check if over is completed and enforce mandatory bowler change
  useEffect(() => {
    if (currentData?.currentInnings && !overCompletedDialogOpen && !changeBowlerMutation.isPending && currentData.recentBalls.length > 0) {
      const currentOverNumber = currentData.recentBalls[0].overNumber;
      
      // Debounce: Don't show dialog within 2 seconds of a bowler change
      const timeSinceLastChange = Date.now() - lastBowlerChangeTime;
      if (timeSinceLastChange < 2000) {
        console.log(`Debouncing over completion dialog (${timeSinceLastChange}ms since last bowler change)`);
        return;
      }
      
      // Count valid balls in current over (exclude wide balls and no-balls)
      const currentOverBalls = currentData.recentBalls.filter(ball => 
        ball.overNumber === currentOverNumber && 
        (!ball.extraType || (ball.extraType !== 'wide' && ball.extraType !== 'noball'))
      );
      
      // ICC Rule 17.1: Over is complete after 6 valid balls - bowler MUST be changed
      if (currentOverBalls.length >= 6) {
        console.log(`ICC Rule 17.1: Over ${currentOverNumber} is complete with ${currentOverBalls.length} valid balls. Bowler must be changed.`);
        setOverCompletedDialogOpen(true);
      }
    }
  }, [currentData?.recentBalls, overCompletedDialogOpen, changeBowlerMutation.isPending, lastBowlerChangeTime]);

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
      // Close dialog immediately and mark openers as set
      setOpenersDialogOpen(false);
      setOpenersSetComplete(true);
      setSelectedOpener1('');
      setSelectedOpener2('');
      setSelectedStriker('');
      
      // Show success message
      toast({
        title: "Openers Set",
        description: "The opening batsmen have been set successfully.",
      });
      
      // Invalidate and refetch without full page reload
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
      queryClient.refetchQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set openers. Please try again.",
        variant: "destructive",
      });
    }
  });

  const newBatsmanMutation = useMutation({
    mutationFn: async (newBatsmanId: string) => {
      const response = await apiRequest('POST', `/api/matches/${matchId}/new-batsman`, {
        newBatsmanId: parseInt(newBatsmanId)
      });
      return response.json();
    },
    onSuccess: () => {
      // Close dialog immediately
      setNewBatsmanDialogOpen(false);
      setSelectedNewBatsman('');
      setOutBatsmanName('');
      
      // Show success message
      toast({
        title: "New Batsman Added",
        description: "The new batsman has been added to the crease.",
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/matches', matchId, 'live'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add new batsman. Please try again.",
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

  // Check if no balls have been bowled and prompt for opener selection
  useEffect(() => {
    if (currentData?.currentInnings && currentData.currentInnings.totalBalls === 0 && isMatchStarted) {
      // Only show dialog if no batsmen are currently set (openers not set)
      const hasBatsmen = currentData.currentBatsmen && currentData.currentBatsmen.length > 0;
      // Don't reopen dialog if mutation is pending or openers have already been set successfully
      if (!hasBatsmen && !openersDialogOpen && !setOpenersMutation.isPending && !openersSetComplete) {
        setOpenersDialogOpen(true);
      }
    }
  }, [currentData?.currentInnings.totalBalls, currentData?.currentBatsmen, isMatchStarted, openersDialogOpen, setOpenersMutation.isPending, openersSetComplete]);

  const handleCommand = (command: ParsedCommand) => {
    if (!isMatchStarted && command.type !== 'timeout' && command.type !== 'review') {
      toast({
        title: "Match Not Started",
        description: "Please start the match before scoring.",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple simultaneous ball additions
    if ((command.type === 'runs' || command.type === 'extra') && (isAddingBall || addBallMutation.isPending)) {
      console.log('Ignoring duplicate ball command - already processing');
      return;
    }

    switch (command.type) {
      case 'correction':
        if (!undoBallMutation.isPending) {
          undoBallMutation.mutate();
        }
        break;
        
      case 'runs':
      case 'extra':
        setIsAddingBall(true);
        addBallMutation.mutate(command);
        break;
        
      case 'bowler_change':
        if (command.bowlerName) {
          // Try to find bowler by name and set them
          const bowlingTeam = currentData?.currentInnings.bowlingTeam;
          if (bowlingTeam) {
            // For now, just open the change bowler dialog
            // In a real implementation, we'd search for the player by name
            setChangeBowlerDialogOpen(true);
            toast({
              title: "Bowler Change Requested",
              description: `Voice command recognized: ${command.bowlerName} to bowl. Please select from the dropdown.`,
            });
          }
        } else {
          setChangeBowlerDialogOpen(true);
        }
        break;
        
      case 'batsman_change':
        if (command.action === 'retire') {
          toast({
            title: "Batsman Retirement",
            description: `Voice command: ${command.newPlayerName || 'Batsman'} ${command.action}. Use the advanced scorer for detailed retirement options.`,
          });
        } else {
          setNewBatsmanDialogOpen(true);
          if (command.newPlayerName) {
            toast({
              title: "New Batsman Requested",
              description: `Voice command recognized: ${command.newPlayerName} to bat. Please select from the dropdown.`,
            });
          }
        }
        break;
        
      case 'strike_rotation':
        toast({
          title: "Strike Rotation",
          description: `Voice command recognized. Strike rotation happens automatically based on runs scored.`,
        });
        break;
        
      case 'over_complete':
        if (currentData?.currentInnings) {
          const ballsInCurrentOver = currentData.currentInnings.totalBalls % 6;
          if (ballsInCurrentOver === 0 && currentData.currentInnings.totalBalls > 0 && !overCompletedDialogOpen) {
            setOverCompletedDialogOpen(true);
            toast({
              title: "Over Complete",
              description: "Voice command confirmed. Please select the next bowler.",
            });
          } else if (ballsInCurrentOver !== 0) {
            toast({
              title: "Over Not Complete",
              description: `${6 - ballsInCurrentOver} balls remaining in this over.`,
              variant: "destructive",
            });
          }
        }
        break;
        
      case 'timeout':
        setTimeoutDialogOpen(true);
        toast({
          title: "Timeout Requested",
          description: "Voice command recognized. Please specify the duration.",
        });
        break;
        
      case 'review':
        toast({
          title: "Review System",
          description: "Voice command recognized. DRS/Review functionality would be implemented here.",
        });
        break;
        
      default:
        toast({
          title: "Command Not Recognized",
          description: "Please try again with a clearer voice command.",
          variant: "destructive",
        });
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="relative mb-6">
            {/* Cricket-themed loading spinner */}
            <div className="w-16 h-16 mx-auto relative">
              <div className="absolute inset-0 border-4 border-green-200 rounded-full animate-spin border-t-green-600"></div>
              <div className="absolute inset-2 flex items-center justify-center text-2xl">🏏</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            Loading Cricket Match
          </h2>
          <div className="text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <p className="mt-3">Setting up the scoreboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // If no live data but basic match exists, show start match interface
  if (!currentData && basicMatchData && (basicMatchData as any).status !== 'live') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-cricket-primary text-white shadow-lg">
          <div className="container mx-auto px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold truncate">Cricket Voice Scorer</h1>
                  <div className="text-xs sm:text-sm text-cricket-light">Match Ready to Start</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <Button
                  onClick={() => setLocation(`/match-settings/${matchId}`)}
                  className="bg-cricket-accent hover:bg-orange-600 text-xs sm:text-sm px-3 py-2 h-8 sm:h-9"
                  size="sm"
                >
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Match Settings</span>
                  <span className="sm:hidden">Settings</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  {basicMatchData?.team1?.name || 'Team 1'} vs {basicMatchData?.team2?.name || 'Team 2'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {basicMatchData?.matchType || 'Cricket'} Match • {basicMatchData?.overs || 20} Overs
                </p>
                <div className="bg-blue-50 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Ready to Start!</h3>
                  <p className="text-blue-700 mb-4">
                    The match is set up and ready to begin. Click the button below to start the first innings.
                  </p>
                  <Button
                    onClick={handleStartMatch}
                    disabled={startMatchMutation.isPending}
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {startMatchMutation.isPending ? 'Starting Match...' : 'Start Match'}
                  </Button>
                </div>
                <div className="text-sm text-gray-500">
                  Make sure to configure match settings before starting if needed.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Use basic match data if available, even if currentData is not available
  const fallbackData = currentData || basicMatchData;
  
  // Show the scoring interface if we have any data (live or basic) and the match is live
  if (fallbackData && (fallbackData as any).status === 'live') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Live Cricket Match</h1>
            <p className="text-gray-600">Scoring interface is loading...</p>
            <div className="mt-4">
              <Button onClick={() => setLocation('/matches')} variant="outline">
                Back to Matches
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !fallbackData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="relative mb-6">
            {/* Error state with cricket theme */}
            <div className="w-16 h-16 mx-auto relative">
              <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
              <div className="absolute inset-2 flex items-center justify-center text-2xl">⚠️</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Unable to Load Match
          </h2>
          <div className="text-gray-600 dark:text-gray-400 mb-6">
            <p>Please check your connection and try again.</p>
            <p className="text-sm mt-2">The match data might be temporarily unavailable.</p>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              🔄 Retry Loading
            </Button>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline"
              className="block mx-auto"
            >
              🏠 Go to Matches
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure currentData exists before rendering
  if (!currentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading Match Data</h2>
          <p className="text-gray-600">Please wait while we load the match information...</p>
          <Button onClick={() => setLocation('/matches')} variant="outline" className="mt-4">
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }

  // Debug logging to understand the data structure
  console.log('currentData:', currentData);
  console.log('currentData.currentBatsmen:', currentData?.currentBatsmen);
  console.log('currentData.match:', currentData?.match);
  console.log('currentData.currentInnings:', currentData?.currentInnings);

  // Safe property access with proper null checks
  const currentBatsmen = currentData?.currentBatsmen || [];
  const striker = currentBatsmen.find(b => b?.isOnStrike);
  const nonStriker = currentBatsmen.find(b => !b?.isOnStrike);

  // Helper function to calculate current over display
  const getCurrentOverDisplay = () => {
    if (!currentData?.recentBalls?.length) return "1.0";
    const currentOverNumber = currentData.recentBalls[0].overNumber;
    const validBallsInOver = currentData.recentBalls.filter(ball => 
      ball.overNumber === currentOverNumber && 
      (!ball.extraType || ball.extraType === 'bye' || ball.extraType === 'legbye')
    ).length;
    return `${currentOverNumber}.${validBallsInOver}`;
  };

  // Check if essential data is available
  if (!currentData.match || !currentData.currentInnings) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Data Loading Error</h2>
          <p className="text-gray-600 mb-4">Match data is incomplete. Please try refreshing the page.</p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white">
              Refresh Page
            </Button>
            <Button onClick={() => setLocation('/matches')} variant="outline">
              Back to Matches
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-full-height bg-gray-50">
      {/* Header */}
      <header className="bg-cricket-primary text-white shadow-lg">
        <div className="container mx-auto px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold truncate">Cricket Voice Scorer</h1>
                {currentData && currentData.currentInnings && (
                  <div className="text-xs sm:text-sm text-cricket-light">
                    {currentData.currentInnings.inningsNumber === 1 ? "1st" : "2nd"} Innings - {currentData.currentInnings.battingTeam?.name || 'Team'} Batting
                  </div>
                )}
              </div>
              {!isConnected && (
                <span className="text-xs bg-red-500 px-2 py-1 rounded flex-shrink-0">Offline</span>
              )}
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <Button
                onClick={handleShareScoreboard}
                className="bg-cricket-accent hover:bg-orange-600 text-xs sm:text-sm px-3 py-2 h-8 sm:h-9"
                size="sm"
              >
                <Share className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Share Scoreboard</span>
                <span className="sm:hidden">Share</span>
              </Button>
              <Button 
                className="bg-cricket-secondary hover:bg-green-900 text-xs sm:text-sm px-3 py-2 h-8 sm:h-9 hidden md:flex"
                size="sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto scoreboard-mobile">
        {/* Match Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div className="mb-4 md:mb-0">
                <h2 className="text-2xl font-bold text-gray-800">
                  {currentData?.match?.team1?.name || 'Team 1'} vs {currentData?.match?.team2?.name || 'Team 2'}
                </h2>
                <div className="space-y-1">
                  <p className="text-gray-600">
                    {currentData?.match?.matchType || 'T20'} Match • Over {getCurrentOverDisplay()} of {currentData?.match?.overs || 20}
                  </p>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-semibold text-green-700">
                        {currentData?.currentInnings?.battingTeam?.name || 'Team 1'} Batting
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="font-semibold text-red-700">
                        {currentData?.currentInnings?.bowlingTeam?.name || 'Team 2'} Bowling
                      </span>
                    </div>
                    <div className="bg-blue-100 px-2 py-1 rounded text-blue-800 font-medium">
                      {currentData?.currentInnings?.inningsNumber === 1 ? "1st" : "2nd"} Innings
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-3xl font-bold text-cricket-primary">
                    {currentData?.currentInnings?.totalRuns || 0}/{currentData?.currentInnings?.totalWickets || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    {getCurrentOverDisplay()} Overs
                  </div>
                </div>
                {!isMatchStarted && (
                  <Button
                    onClick={handleStartMatch}
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

        <div className="space-y-4 sm:space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="live">🔴 Live</TabsTrigger>
              <TabsTrigger value="statistics">📊 Statistics</TabsTrigger>
            </TabsList>
              
              <TabsContent value="live" className="space-y-4 sm:space-y-6 mt-6">
            {/* Advanced Scorer and Quick Actions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Advanced Scorer - 2/3 width */}
              <div className="lg:col-span-2">
                <Card className="shadow-lg border-2 border-blue-200">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-blue-800 flex items-center">
                      📊 Advanced Scorer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AdvancedScorer 
                      matchData={currentData}
                      matchId={matchId!}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions - 1/3 width */}
              <div className="lg:col-span-1">
                <Card className="shadow-lg border-2 border-gray-200 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                      ⚡ Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Change Bowler Dialog */}
                      <Dialog open={changeBowlerDialogOpen} onOpenChange={setChangeBowlerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="mobile-button w-full bg-cricket-primary hover:bg-cricket-secondary text-white touch-feedback"
                            disabled={!isMatchStarted}
                          >
                            <User className="h-4 w-4 mr-2" />
                            <span className="mobile-text">Change Bowler</span>
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
                            className="mobile-button w-full bg-blue-500 hover:bg-blue-600 text-white touch-feedback"
                            disabled={!isMatchStarted}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            <span className="mobile-text">Timeout</span>
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

                      {/* Change Batsmen Button - Hidden after first ball is completed */}
                      {!currentData.currentInnings.balls || currentData.currentInnings.balls.length === 0 || 
                       currentData.currentBatsmen.length < 2 ? (
                        <Button
                          variant="outline"
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => setOpenersDialogOpen(true)}
                          disabled={!isMatchStarted}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          {currentData.currentInnings.balls?.length === 0 ? 'Select Openers' : 'Change Batsmen'}
                        </Button>
                      ) : null}

                      {/* Quick Action Buttons */}
                      <div className="space-y-2">
                        {/* Undo Last Ball */}
                        <Button
                          variant="outline"
                          className="w-full bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400 disabled:text-gray-600"
                          onClick={() => undoBallMutation.mutate()}
                          disabled={undoBallMutation.isPending || !isMatchStarted || currentData.recentBalls.length === 0}
                        >
                          <Undo className="h-4 w-4 mr-2" />
                          {undoBallMutation.isPending ? 'Undoing...' : 
                           currentData.recentBalls.length === 0 ? 'No Balls to Undo' : 'Undo Last Ball'}
                        </Button>

                        {/* Switch Strike */}
                        <Button
                          variant="outline"
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400 disabled:text-gray-600"
                          onClick={() => switchStrikeMutation.mutate()}
                          disabled={switchStrikeMutation.isPending || !isMatchStarted || currentData.currentBatsmen.length < 2}
                        >
                          <ArrowLeftRight className="h-4 w-4 mr-2" />
                          {switchStrikeMutation.isPending ? 'Switching...' : 
                           currentData.currentBatsmen.length < 2 ? 'Need 2 Batsmen' : 'Switch Strike'}
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

                        {/* End Innings - Moved to bottom with confirmation */}
                        <div className="pt-2 border-t border-gray-200">
                          <Dialog open={endInningsDialogOpen} onOpenChange={setEndInningsDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400 disabled:text-gray-600"
                                disabled={!isMatchStarted || endInningsMutation.isPending || currentData?.currentInnings?.isCompleted || currentData?.match?.status === 'completed'}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                {endInningsMutation.isPending ? 'Ending Innings...' : 
                                 currentData?.currentInnings?.isCompleted ? 'Innings Completed' :
                                 currentData?.match?.status === 'completed' ? 'Match Completed' : 'End Innings'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>⚠️ Confirm End Innings</DialogTitle>
                                <DialogDescription>
                                  This action will end the current innings and cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Are you sure you want to end the current innings? This action cannot be reverted.
                                </p>
                                {currentData?.currentInnings?.inningsNumber === 1 ? (
                                  <p className="text-sm bg-blue-50 p-3 rounded">
                                    <strong>First Innings:</strong> This will end the first innings and automatically start the second innings with teams swapped.
                                  </p>
                                ) : (
                                  <p className="text-sm bg-red-50 p-3 rounded">
                                    <strong>Second Innings:</strong> This will complete the entire match and show final results.
                                  </p>
                                )}
                                <div className="flex justify-end space-x-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setEndInningsDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => {
                                      endInningsMutation.mutate();
                                      setEndInningsDialogOpen(false);
                                    }}
                                    disabled={endInningsMutation.isPending}
                                  >
                                    <Pause className="h-4 w-4 mr-2" />
                                    {endInningsMutation.isPending ? 'Ending...' : 'Confirm End Innings'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Current Over - Live Component */}
            <Card className="shadow-lg border-2 border-purple-200 min-h-[250px]">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-purple-800 flex items-center">
                  ⚾ Current Over
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CurrentOver
                  balls={currentData.currentInnings.balls}
                  bowlerName={currentData.currentBowler?.player.name || 'Unknown'}
                  overNumber={currentData.recentBalls.length > 0 ? currentData.recentBalls[0].overNumber : 1}
                  totalBalls={currentData.currentInnings.totalBalls}
                  currentBowlerStats={currentData.currentBowler ? {
                    ballsBowled: currentData.currentBowler.ballsBowled || 0,
                    runsConceded: currentData.currentBowler.runsConceded || 0,
                    wicketsTaken: currentData.currentBowler.wicketsTaken || 0
                  } : undefined}
                />
              </CardContent>
            </Card>

            {/* Commentary - Live Component */}
            <Card className="shadow-lg border-2 border-teal-200 min-h-[400px]">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-teal-800 flex items-center">
                  📝 Live Commentary
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[350px] overflow-y-auto">
                <Commentary balls={currentData.recentBalls} />
              </CardContent>
            </Card>

            {/* Voice Input Panel - Moved to Bottom */}
            <Card className="shadow-lg border-2 border-green-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-green-800 flex items-center">
                  🎤 Voice Input & Quick Scoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceInput
                  onCommand={handleCommand}
                  currentBatsman={striker?.player.name}
                  currentBowler={currentData.currentBowler?.player.name}
                />
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="statistics" className="space-y-4 sm:space-y-6 mt-6">
                {/* Team Statistics - Statistics Component */}
                <Card className="shadow-lg border-2 border-cyan-200 min-h-[250px]">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-cyan-800 flex items-center">
                      📈 Team Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TeamStats
                      innings={currentData.currentInnings}
                      targetRuns={undefined}
                      targetOvers={currentData.match.overs}
                    />
                  </CardContent>
                </Card>

                {/* Batting Figures - Statistics Component */}
                <Card className="shadow-lg border-2 border-orange-200 min-h-[400px]">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-orange-800 flex items-center">
                      🏏 Batting Figures
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[350px] overflow-y-auto">
                    <div className="space-y-3">
                      {currentData.currentInnings.playerStats
                        .filter(stat => stat.player.teamId === currentData.currentInnings.battingTeam.id && stat.ballsFaced > 0)
                        .sort((a, b) => b.runs - a.runs)
                        .map((batsman) => {
                          const isCurrentBatsman = currentBatsmen.some(cb => cb.playerId === batsman.playerId);
                          const strikeRate = batsman.ballsFaced > 0 ? ((batsman.runs / batsman.ballsFaced) * 100).toFixed(1) : '0.0';
                          const isOnStrike = currentBatsmen.find(cb => cb.playerId === batsman.playerId)?.isOnStrike;
                          
                          return (
                            <div
                              key={batsman.id}
                              className={`flex justify-between items-center p-3 rounded-lg ${
                                isCurrentBatsman
                                  ? isOnStrike 
                                    ? 'bg-cricket-light border border-cricket-primary'
                                    : 'bg-blue-50 border border-blue-200'
                                  : batsman.isOut 
                                    ? 'bg-red-50 border border-red-200'
                                    : 'bg-gray-50'
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-gray-800 flex items-center">
                                  {batsman.player.name}
                                  {isOnStrike && <span className="ml-2 text-orange-500">*</span>}
                                  {isCurrentBatsman && !isOnStrike && <span className="ml-2 text-blue-500">•</span>}
                                  {batsman.isOut && (
                                    <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">
                                      OUT
                                    </span>
                                  )}
                                  {isCurrentBatsman && !batsman.isOut && (
                                    <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                                      BATTING
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  SR: {strikeRate} • {batsman.fours} fours • {batsman.sixes} sixes
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-lg">{batsman.runs}</div>
                                <div className="text-sm text-gray-600">({batsman.ballsFaced} balls)</div>
                              </div>
                            </div>
                          );
                        })}
                      
                      {currentData.currentInnings.playerStats.filter(stat => 
                        stat.player.teamId === currentData.currentInnings.battingTeam.id && stat.ballsFaced > 0
                      ).length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          No batting figures available yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Bowling Figures - Statistics Component */}
                <Card className="shadow-lg border-2 border-red-200 min-h-[250px]">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-red-800 flex items-center">
                      🎯 Bowling Figures
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[200px] overflow-y-auto">
                    <BowlingFigures
                      bowlingStats={currentData.currentInnings.playerStats.filter(s => s.ballsBowled > 0)}
                      currentBowlerId={currentData.currentBowler?.playerId}
                    />
                  </CardContent>
                </Card>

                {/* Match Statistics - Statistics Component */}
                <Card className="shadow-lg border-2 border-indigo-200 min-h-[400px]">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-indigo-800 flex items-center">
                      📊 Match Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MatchStatistics matchData={currentData} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* Over Completed Dialog */}
      <Dialog 
        open={overCompletedDialogOpen} 
        onOpenChange={(open) => {
          console.log(`Over completed dialog onOpenChange: ${open}`);
          setOverCompletedDialogOpen(open);
          if (!open) {
            setNextBowlerId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ICC Rule 17.1 - Over Complete - Bowler Must Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              6 valid balls have been bowled in this over. According to ICC cricket rules, the bowler must be changed before the next over can begin.
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
              <Button 
                onClick={() => {
                  console.log('Change bowler button clicked');
                  if (nextBowlerId) {
                    changeBowlerMutation.mutate(nextBowlerId);
                  }
                }}
                disabled={!nextBowlerId || changeBowlerMutation.isPending}
                className="w-full"
              >
                <User className="w-4 h-4 mr-2" />
                {changeBowlerMutation.isPending ? 'Changing Bowler...' : 'Change Bowler'}
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

      {/* New Batsman Selection Dialog */}
      <Dialog open={newBatsmanDialogOpen} onOpenChange={setNewBatsmanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select New Batsman</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{outBatsmanName}</span> is out. Please select the next batsman to come to the crease.
            </p>
            
            <div>
              <Label htmlFor="new-batsman">New Batsman</Label>
              <Select value={selectedNewBatsman} onValueChange={setSelectedNewBatsman}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new batsman" />
                </SelectTrigger>
                <SelectContent>
                  {availableBatsmen
                    .filter(batsman => {
                      // Filter out batsmen who are already on the crease or out
                      const isCurrentlyBatting = currentData?.currentBatsmen.some(cb => cb.playerId === batsman.id);
                      const isOut = currentData?.currentInnings.playerStats.some(
                        stat => stat.playerId === batsman.id && stat.isOut
                      );
                      return !isCurrentlyBatting && !isOut;
                    })
                    .map((batsman) => (
                      <SelectItem key={batsman.id} value={batsman.id.toString()}>
                        {batsman.name} ({batsman.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setNewBatsmanDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => newBatsmanMutation.mutate(selectedNewBatsman)}
                disabled={!selectedNewBatsman || newBatsmanMutation.isPending}
              >
                <User className="w-4 h-4 mr-2" />
                {newBatsmanMutation.isPending ? 'Adding...' : 'Add Batsman'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toss Capture Dialog */}
      <Dialog open={tossDialogOpen} onOpenChange={setTossDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Toss</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Before starting the match, please capture the toss details.
            </p>
            
            <div>
              <Label htmlFor="toss-winner">Toss Winner</Label>
              <Select value={tossWinner} onValueChange={setTossWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select toss winner" />
                </SelectTrigger>
                <SelectContent>
                  {basicMatchData && (
                    <>
                      <SelectItem value={(basicMatchData as any).team1Id?.toString() || '1'}>
                        {(basicMatchData as any).team1?.name || 'Team 1'}
                      </SelectItem>
                      <SelectItem value={(basicMatchData as any).team2Id?.toString() || '2'}>
                        {(basicMatchData as any).team2?.name || 'Team 2'}
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="toss-decision">Toss Decision</Label>
              <Select value={tossDecision} onValueChange={setTossDecision}>
                <SelectTrigger>
                  <SelectValue placeholder="Select toss decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bat">Choose to Bat First</SelectItem>
                  <SelectItem value="bowl">Choose to Bowl First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setTossDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTossSubmit}
                disabled={!tossWinner || !tossDecision || startMatchMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                {startMatchMutation.isPending ? 'Starting Match...' : 'Start Match'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
