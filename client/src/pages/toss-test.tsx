import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TossTest() {
  const [isTossDialogOpen, setIsTossDialogOpen] = useState(false);
  const [tossData, setTossData] = useState({
    tossWinnerId: '',
    tossDecision: 'bat' as 'bat' | 'bowl'
  });

  const selectedMatch = {
    id: 5,
    team1: { id: 1, name: 'Chiefs' },
    team2: { id: 2, name: 'Lions' },
    team1Id: 1,
    team2Id: 2,
    matchType: 'T20',
    overs: 20
  };

  const handleTossSubmit = () => {
    console.log('Toss submitted:', tossData);
    alert(`Toss submitted: ${tossData.tossWinnerId === '1' ? 'Chiefs' : 'Lions'} won and chose to ${tossData.tossDecision} first`);
    setIsTossDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Toss Dialog Test Page</h1>
        
        <div className="space-y-4">
          <Button 
            onClick={() => {
              console.log('Opening toss dialog');
              setTossData({ tossWinnerId: '1', tossDecision: 'bat' });
              setIsTossDialogOpen(true);
            }}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Test Toss Dialog (shadcn)
          </Button>

          <button 
            onClick={() => {
              console.log('Opening basic modal');
              setIsTossDialogOpen(true);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded ml-4"
          >
            Test Basic Modal
          </button>

          <div className="mt-4 p-4 bg-yellow-100 rounded">
            <p>Dialog State: {isTossDialogOpen ? 'OPEN' : 'CLOSED'}</p>
          </div>
        </div>

        {/* Basic Modal Version */}
        {isTossDialogOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
            onClick={() => setIsTossDialogOpen(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                padding: '30px',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
                Start Match - Toss Details
              </h2>
              
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
                <h3 style={{ fontWeight: 'bold', fontSize: '18px' }}>
                  {selectedMatch.team1.name} vs {selectedMatch.team2.name}
                </h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  {selectedMatch.matchType} • {selectedMatch.overs} overs
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Toss Winner</label>
                <select 
                  value={tossData.tossWinnerId}
                  onChange={(e) => setTossData({ ...tossData, tossWinnerId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                >
                  <option value="">Select toss winner</option>
                  <option value="1">{selectedMatch.team1.name}</option>
                  <option value="2">{selectedMatch.team2.name}</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Toss Decision</label>
                <select 
                  value={tossData.tossDecision}
                  onChange={(e) => setTossData({ ...tossData, tossDecision: e.target.value as 'bat' | 'bowl' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                >
                  <option value="bat">Bat First</option>
                  <option value="bowl">Bowl First</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleTossSubmit}
                  disabled={!tossData.tossWinnerId}
                  style={{
                    flex: 1,
                    backgroundColor: tossData.tossWinnerId ? '#22c55e' : '#ccc',
                    color: 'white',
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: tossData.tossWinnerId ? 'pointer' : 'not-allowed',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  Start Match
                </button>
                <button 
                  onClick={() => setIsTossDialogOpen(false)}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shadcn Dialog Version */}
        <Dialog open={false} onOpenChange={setIsTossDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Start Match - Toss Details (shadcn)</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg">
                  {selectedMatch.team1.name} vs {selectedMatch.team2.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedMatch.matchType} • {selectedMatch.overs} overs
                </p>
              </div>

              <div>
                <Label htmlFor="toss-winner">Toss Winner</Label>
                <Select
                  value={tossData.tossWinnerId}
                  onValueChange={(value) => setTossData({ ...tossData, tossWinnerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select toss winner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{selectedMatch.team1.name}</SelectItem>
                    <SelectItem value="2">{selectedMatch.team2.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="toss-decision">Toss Decision</Label>
                <Select
                  value={tossData.tossDecision}
                  onValueChange={(value: 'bat' | 'bowl') => setTossData({ ...tossData, tossDecision: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bat">Bat First</SelectItem>
                    <SelectItem value="bowl">Bowl First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleTossSubmit}
                  disabled={!tossData.tossWinnerId}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  Start Match
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsTossDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}