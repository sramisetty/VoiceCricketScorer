import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ball } from '@shared/schema';
import { cn } from '@/lib/utils';

interface CurrentOverProps {
  balls: Ball[];
  bowlerName: string;
  overNumber: number;
  totalBalls: number;
  currentBowlerStats?: {
    ballsBowled: number;
    runsConceded: number;
    wicketsTaken: number;
  };
}

export function CurrentOver({ balls, bowlerName, overNumber, totalBalls, currentBowlerStats }: CurrentOverProps) {
  // Get balls from current over - if no balls exist for this over, we'll show an empty over
  const currentOverBalls = balls
    .filter(ball => ball.overNumber === overNumber)
    .sort((a, b) => a.ballNumber - b.ballNumber);

  const getBallDisplay = (ball: Ball) => {
    if (ball.isWicket) return 'W';
    if (ball.extraType) return ball.extraType.charAt(0).toUpperCase();
    return ball.runs.toString();
  };

  const getBallColor = (ball: Ball) => {
    if (ball.isWicket) return 'bg-red-500 text-white';
    if (ball.runs === 4) return 'bg-cricket-accent text-white';
    if (ball.runs === 6) return 'bg-cricket-accent text-white';
    if (ball.extraType) return 'bg-yellow-500 text-white';
    if (ball.runs > 0) return 'bg-cricket-primary text-white';
    return 'bg-gray-300 text-gray-600';
  };

  // Calculate over stats
  const overRuns = currentOverBalls.reduce((total, ball) => {
    return total + ball.runs + (ball.extraRuns || 0);
  }, 0);

  const wickets = currentOverBalls.filter(ball => ball.isWicket).length;
  
  // Count valid balls in current over from database (most accurate)
  const validBallsInOver = currentOverBalls.filter(ball => 
    !ball.extraType || (ball.extraType === 'bye' || ball.extraType === 'legbye')
  ).length;
  
  // Calculate total valid balls from all balls to show correct over count
  const allValidBalls = balls.filter(ball => 
    !ball.extraType || (ball.extraType === 'bye' || ball.extraType === 'legbye')
  ).length;
  
  const validBallsBowled = validBallsInOver;
  const ballsRemaining = validBallsInOver >= 6 ? 0 : 6 - validBallsInOver;

  // Show all balls in the over (including extras), but only show valid balls 1-6 with placeholders
  const validBalls = currentOverBalls.filter(ball => !ball.extraType || ball.extraType === 'bye' || ball.extraType === 'legbye');
  const extraBalls = currentOverBalls.filter(ball => ball.extraType && ball.extraType !== 'bye' && ball.extraType !== 'legbye');
  
  // Create array of 6 valid balls with placeholders
  const ballsDisplay = Array.from({ length: 6 }, (_, index) => {
    const ball = validBalls.find(b => b.ballNumber === index + 1);
    return ball || null;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">Current Over</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-cricket-primary">
            Over {Math.max(0, Math.floor(allValidBalls / 6))}.{allValidBalls % 6}
          </div>
          <div className="text-sm text-gray-600">{bowlerName} bowling</div>
          {currentBowlerStats && (
            <div className="text-xs text-blue-600 font-medium mt-1">
              {currentBowlerStats.ballsBowled}-{currentBowlerStats.runsConceded}-{currentBowlerStats.wicketsTaken}
            </div>
          )}
          {ballsRemaining > 0 && (
            <div className="text-xs text-cricket-accent font-semibold mt-1">
              {ballsRemaining} ball{ballsRemaining !== 1 ? 's' : ''} remaining
            </div>
          )}
          {ballsRemaining === 0 && totalBalls > 0 && totalBalls % 6 === 0 && (
            <div className="text-xs text-green-600 font-semibold mt-1">
              Over complete
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Valid balls (1-6) */}
          <div className="flex justify-center space-x-2">
            {ballsDisplay.map((ball, index) => (
              <div
                key={index}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  ball ? getBallColor(ball) : "bg-gray-200 text-gray-400"
                )}
              >
                {ball ? getBallDisplay(ball) : '•'}
              </div>
            ))}
          </div>
          
          {/* Extra balls (wides, no-balls) */}
          {extraBalls.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-center text-gray-500">Extras:</div>
              <div className="flex justify-center space-x-1">
                {extraBalls.map((ball, index) => (
                  <div
                    key={`extra-${index}`}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      getBallColor(ball)
                    )}
                  >
                    {getBallDisplay(ball)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-gray-600 text-sm space-y-1">
          <div>
            {overRuns} runs • {validBallsBowled}/6 balls bowled
            {wickets > 0 && ` • ${wickets} wicket${wickets > 1 ? 's' : ''}`}
          </div>
          {extraBalls.length > 0 && (
            <div className="text-xs">
              ({extraBalls.length} extra ball{extraBalls.length !== 1 ? 's' : ''})
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
