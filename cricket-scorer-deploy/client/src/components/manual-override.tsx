import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Undo } from 'lucide-react';
import { type ParsedCommand } from '@/lib/cricket-parser';

interface ManualOverrideProps {
  onCommand: (command: ParsedCommand) => void;
  onUndo: () => void;
}

export function ManualOverride({ onCommand, onUndo }: ManualOverrideProps) {
  const [selectedRuns, setSelectedRuns] = useState<string>('');
  const [selectedExtra, setSelectedExtra] = useState<string>('');

  const handleAddScore = () => {
    if (selectedRuns) {
      const runs = parseInt(selectedRuns);
      onCommand({
        type: 'runs',
        runs,
        confidence: 1.0
      });
      setSelectedRuns('');
    } else if (selectedExtra) {
      let extraType: ParsedCommand['extraType'] = 'wide';
      let extraRuns = 1;

      switch (selectedExtra) {
        case 'wide':
          extraType = 'wide';
          extraRuns = 1;
          break;
        case 'noball':
          extraType = 'noball';
          extraRuns = 1;
          break;
        case 'bye':
          extraType = 'bye';
          extraRuns = 1;
          break;
        case 'legbye':
          extraType = 'legbye';
          extraRuns = 1;
          break;
      }

      onCommand({
        type: 'extra',
        extraType,
        extraRuns,
        confidence: 1.0
      });
      setSelectedExtra('');
    }
  };

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800">Manual Override</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          className="text-cricket-primary hover:text-cricket-secondary"
        >
          <Undo className="h-4 w-4 mr-1" />
          Undo Last
        </Button>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <Select value={selectedRuns} onValueChange={setSelectedRuns}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Runs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 Runs</SelectItem>
            <SelectItem value="1">1 Run</SelectItem>
            <SelectItem value="2">2 Runs</SelectItem>
            <SelectItem value="3">3 Runs</SelectItem>
            <SelectItem value="4">4 Runs</SelectItem>
            <SelectItem value="5">5 Runs</SelectItem>
            <SelectItem value="6">6 Runs</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedExtra} onValueChange={setSelectedExtra}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Extras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wide">Wide</SelectItem>
            <SelectItem value="noball">No Ball</SelectItem>
            <SelectItem value="bye">Bye</SelectItem>
            <SelectItem value="legbye">Leg Bye</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={handleAddScore}
          disabled={!selectedRuns && !selectedExtra}
          className="bg-cricket-primary hover:bg-cricket-secondary text-white text-sm"
        >
          Add
        </Button>
      </div>

      <Separator className="my-3" />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onCommand({
            type: 'wicket',
            isWicket: true,
            wicketType: 'caught',
            confidence: 1.0
          })}
        >
          Wicket
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCommand({
            type: 'bowler_change',
            confidence: 1.0
          })}
          className="text-cricket-primary hover:bg-cricket-primary hover:text-white"
        >
          Change Bowler
        </Button>
      </div>
    </div>
  );
}
