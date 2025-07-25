import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ball, type Player } from '@shared/schema';
import { cn } from '@/lib/utils';

interface CommentaryProps {
  balls: (Ball & { batsman: Player; bowler: Player })[];
}

export function Commentary({ balls }: CommentaryProps) {
  const getBallStyle = (ball: Ball) => {
    if (ball.isWicket) return 'bg-red-50 border-red-200';
    if ((ball.runs || 0) === 4) return 'bg-cricket-light border-cricket-primary/30';
    if ((ball.runs || 0) === 6) return 'bg-cricket-light border-cricket-primary/30';
    if (ball.extraType) return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getBallNumber = (ball: Ball, ballIndex: number, allBalls: Ball[]) => {
    // Calculate display using same logic as other components
    const ballsInThisOver = allBalls.filter(b => b.overNumber === ball.overNumber);
    const validBallsInOver = ballsInThisOver.filter(b => 
      !b.extraType || b.extraType === 'bye' || b.extraType === 'legbye'
    ).length;
    
    // If this ball completed the over (6 valid balls), show completed over count
    const validBallPosition = ballsInThisOver
      .filter(b => (!b.extraType || b.extraType === 'bye' || b.extraType === 'legbye') && b.ballNumber <= ball.ballNumber)
      .length;
    
    if (validBallsInOver >= 6 && validBallPosition === 6) {
      return `${ball.overNumber}.0`;
    }
    
    return `${ball.overNumber}.${validBallPosition}`;
  };

  const getBallContent = (ball: Ball) => {
    if (ball.isWicket) {
      return `OUT! ${ball.wicketType || 'dismissed'}`;
    }
    if ((ball.runs || 0) === 4) {
      return 'FOUR!';
    }
    if ((ball.runs || 0) === 6) {
      return 'SIX!';
    }
    if (ball.extraType) {
      return ball.extraType.toUpperCase();
    }
    return (ball.runs || 0).toString();
  };

  const getBallColor = (ball: Ball) => {
    if (ball.isWicket) return 'bg-red-500';
    if ((ball.runs || 0) === 4) return 'bg-cricket-accent';
    if ((ball.runs || 0) === 6) return 'bg-cricket-accent';
    if (ball.extraType) return 'bg-yellow-500';
    if ((ball.runs || 0) > 0) return 'bg-cricket-primary';
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Ball-by-Ball Commentary
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
              balls.map((ball, index) => (
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
                    {getBallNumber(ball, index, balls)}
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
                          : (ball.runs || 0) >= 4 
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
