import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ball } from '@shared/schema';
import { cn } from '@/lib/utils';

interface CurrentOverProps {
  balls: Ball[];
  bowlerName: string;
  overNumber: number;
}

export function CurrentOver({ balls, bowlerName, overNumber }: CurrentOverProps) {
  // Get balls from current over
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

  // Create array of 6 balls with placeholders
  const ballsDisplay = Array.from({ length: 6 }, (_, index) => {
    const ball = currentOverBalls.find(b => b.ballNumber === index + 1);
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
            Over {overNumber}
          </div>
          <div className="text-sm text-gray-600">{bowlerName} bowling</div>
        </div>

        <div className="flex justify-center space-x-2 mb-4">
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

        <div className="text-center text-gray-600 text-sm">
          {overRuns} runs
          {wickets > 0 && ` • ${wickets} wicket${wickets > 1 ? 's' : ''}`}
        </div>
      </CardContent>
    </Card>
  );
}
