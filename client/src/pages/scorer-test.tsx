import { useParams } from 'wouter';

export default function ScorerTest() {
  const { matchId } = useParams<{ matchId: string }>();
  
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold">Scorer Test Page</h1>
      <p>Match ID: {matchId}</p>
      <p>This is a test to verify the route works</p>
    </div>
  );
}