import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export default function ScorerSimple() {
  const [, params] = useRoute('/scorer/:matchId');
  const [, setLocation] = useLocation();
  
  const matchId = params?.matchId ? parseInt(params.matchId) : null;

  const { data: currentData, isLoading, error } = useQuery({
    queryKey: ['/api/matches', matchId, 'live'],
    enabled: !!matchId,
  });

  if (!matchId) {
    return (
      <div className="min-h-screen bg-white p-8">
        <h1 className="text-2xl font-bold text-red-600">Invalid Match ID</h1>
        <Button onClick={() => setLocation('/matches')}>Back to Matches</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">Loading Match Data...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-8">
        <h1 className="text-2xl font-bold text-red-600">Error Loading Match</h1>
        <p className="text-gray-600 mb-4">Error: {String(error)}</p>
        <Button onClick={() => setLocation('/matches')}>Back to Matches</Button>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="min-h-screen bg-white p-8">
        <h1 className="text-2xl font-bold text-yellow-600">No Match Data</h1>
        <Button onClick={() => setLocation('/matches')}>Back to Matches</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-green-600">Scorer Page - Data Loaded!</h1>
      <p>Match ID: {matchId}</p>
      <p>Match: {currentData?.match?.team1?.name} vs {currentData?.match?.team2?.name}</p>
      <p>Status: {currentData?.match?.status}</p>
      <Button onClick={() => setLocation('/matches')}>Back to Matches</Button>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold">Debug Info:</h3>
        <pre className="text-xs">{JSON.stringify(currentData, null, 2).slice(0, 500)}...</pre>
      </div>
    </div>
  );
}