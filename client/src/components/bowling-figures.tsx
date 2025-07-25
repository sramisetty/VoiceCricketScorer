import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type PlayerStats, type Player } from '@shared/schema';

interface BowlingFiguresProps {
  bowlingStats: (PlayerStats & { player: Player })[];
  currentBowlerId?: number;
}

export function BowlingFigures({ bowlingStats, currentBowlerId }: BowlingFiguresProps) {
  const activeBowlers = bowlingStats
    .filter(stats => stats.ballsBowled > 0)
    .sort((a, b) => b.ballsBowled - a.ballsBowled);

  const formatFigures = (stats: PlayerStats) => {
    const overs = Math.floor((stats.ballsBowled || 0) / 6);
    const balls = (stats.ballsBowled || 0) % 6;
    const oversString = balls > 0 ? `${overs}.${balls}` : overs.toString();
    return `${oversString}-0-${stats.runsConceded || 0}-${stats.wicketsTaken || 0}`;
  };

  const getEconomy = (stats: PlayerStats) => {
    if ((stats.ballsBowled || 0) === 0) return '0.00';
    return (((stats.runsConceded || 0) * 6) / (stats.ballsBowled || 1)).toFixed(2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">Bowling Figures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeBowlers.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No bowling figures available
            </div>
          ) : (
            activeBowlers.map((stats) => (
              <div
                key={stats.id}
                className={`flex justify-between items-center p-3 rounded-lg ${
                  stats.playerId === currentBowlerId
                    ? 'bg-cricket-light border border-cricket-primary'
                    : 'bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-gray-800 flex items-center">
                    {stats.player.name}
                    {stats.playerId === currentBowlerId && (
                      <span className="ml-2 text-xs bg-cricket-primary text-white px-2 py-1 rounded">
                        Bowling
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {stats.playerId === currentBowlerId ? 'Current bowler' : 'Previous bowler'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatFigures(stats)}</div>
                  <div className="text-sm text-gray-600">Econ: {getEconomy(stats)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
