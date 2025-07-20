import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type InningsWithStats } from '@shared/schema';

interface TeamStatsProps {
  innings: InningsWithStats;
  targetRuns?: number;
  targetOvers?: number;
}

export function TeamStats({ innings, targetRuns, targetOvers }: TeamStatsProps) {
  const runRate = innings.totalBalls > 0 
    ? ((innings.totalRuns * 6) / innings.totalBalls).toFixed(2)
    : '0.00';

  const requiredRate = targetRuns && targetOvers
    ? ((targetRuns - innings.totalRuns) * 6 / ((targetOvers * 6) - innings.totalBalls)).toFixed(2)
    : null;

  const boundaries = innings.balls.reduce((acc, ball) => {
    if (ball.runs === 4) acc.fours++;
    if (ball.runs === 6) acc.sixes++;
    return acc;
  }, { fours: 0, sixes: 0 });

  const extras = innings.extras as any || { wides: 0, noballs: 0, byes: 0, legbyes: 0 };
  const totalExtras = extras.wides + extras.noballs + extras.byes + extras.legbyes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">Team Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Run Rate</span>
            <span className="font-semibold text-cricket-primary">{runRate}</span>
          </div>

          {requiredRate && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Required Rate</span>
              <span className={`font-semibold ${
                parseFloat(requiredRate) > parseFloat(runRate) + 2 
                  ? 'text-red-500' 
                  : 'text-green-500'
              }`}>
                {requiredRate}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Boundaries</span>
            <span className="font-semibold">
              {boundaries.fours} (4s) • {boundaries.sixes} (6s)
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Extras</span>
            <span className="font-semibold">
              {totalExtras} ({extras.wides}w, {extras.noballs}nb, {extras.byes}b, {extras.legbyes}lb)
            </span>
          </div>

          {targetRuns && (
            <div className="bg-cricket-light rounded-lg p-3 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-cricket-primary">
                  Need {targetRuns - innings.totalRuns} runs
                </div>
                <div className="text-sm text-gray-600">
                  in {(targetOvers! * 6) - innings.totalBalls} balls
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
