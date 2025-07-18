import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type Ball, type Player } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Undo } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CommentaryProps {
  balls: (Ball & { batsman: Player; bowler: Player })[];
  matchId: number;
}

export function Commentary({ balls, matchId }: CommentaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const getBallStyle = (ball: Ball) => {
    if (ball.isWicket) return 'bg-red-50 border-red-200';
    if (ball.runs === 4) return 'bg-cricket-light border-cricket-primary/30';
    if (ball.runs === 6) return 'bg-cricket-light border-cricket-primary/30';
    if (ball.extraType) return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getBallNumber = (ball: Ball) => {
    return `${ball.overNumber}.${ball.ballNumber}`;
  };

  const getBallContent = (ball: Ball) => {
    if (ball.isWicket) {
      return `OUT! ${ball.wicketType || 'dismissed'}`;
    }
    if (ball.runs === 4) {
      return 'FOUR!';
    }
    if (ball.runs === 6) {
      return 'SIX!';
    }
    if (ball.extraType) {
      return ball.extraType.toUpperCase();
    }
    return ball.runs.toString();
  };

  const getBallColor = (ball: Ball) => {
    if (ball.isWicket) return 'bg-red-500';
    if (ball.runs === 4) return 'bg-cricket-accent';
    if (ball.runs === 6) return 'bg-cricket-accent';
    if (ball.extraType) return 'bg-yellow-500';
    if (ball.runs > 0) return 'bg-cricket-primary';
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center justify-between">
          Ball-by-Ball Commentary
          {balls.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => undoMutation.mutate()}
              disabled={undoMutation.isPending}
              className="ml-2"
            >
              <Undo className="w-4 h-4 mr-1" />
              Undo Last Ball
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {balls.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No balls bowled yet
              </div>
            ) : (
              balls.map((ball) => (
                <div
                  key={ball.id}
                  className={cn(
                    "flex items-start space-x-3 p-3 rounded-lg border",
                    getBallStyle(ball)
                  )}
                >
                  <div className={cn(
                    "text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0",
                    getBallColor(ball)
                  )}>
                    {getBallNumber(ball)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-gray-800 font-medium text-sm">
                        {ball.bowler.name} to {ball.batsman.name}
                      </p>
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        ball.isWicket 
                          ? "bg-red-100 text-red-800"
                          : ball.runs >= 4 
                          ? "bg-cricket-light text-cricket-primary"
                          : "bg-gray-100 text-gray-700"
                      )}>
                        {getBallContent(ball)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      {ball.commentary || 'No commentary available'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
