import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { parseCricketCommand, generateCommentary, type ParsedCommand } from '@/lib/cricket-parser';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onCommand: (command: ParsedCommand) => void;
  currentBatsman?: string;
  currentBowler?: string;
}

export function VoiceInput({ onCommand, currentBatsman, currentBowler }: VoiceInputProps) {
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    resetTranscript, 
    isSupported 
  } = useVoiceRecognition();

  const [lastCommand, setLastCommand] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (transcript && !isListening) {
      setIsProcessing(true);
      const command = parseCricketCommand(transcript);
      
      if (command.confidence > 0.5) {
        const commentary = generateCommentary(command, currentBatsman, currentBowler);
        setLastCommand(`"${transcript}" - ${commentary}`);
        onCommand(command);
      } else {
        setLastCommand(`"${transcript}" - Command not recognized`);
      }
      
      resetTranscript();
      setIsProcessing(false);
    }
  }, [transcript, isListening, onCommand, currentBatsman, currentBowler, resetTranscript]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            Voice recognition is not supported in this browser
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">Voice Input</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Voice Status */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Button
              onClick={handleMicClick}
              className={cn(
                "w-24 h-24 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105",
                isListening 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-cricket-primary hover:bg-cricket-secondary"
              )}
              disabled={isProcessing}
            >
              {isListening ? (
                <MicOff className="text-white text-2xl" />
              ) : (
                <Mic className="text-white text-2xl" />
              )}
            </Button>
            {isListening && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Current Transcript */}
        {transcript && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="text-blue-500 h-4 w-4" />
              <span className="text-sm font-medium text-blue-700">Listening:</span>
            </div>
            <p className="text-blue-800 italic">"{transcript}"</p>
          </div>
        )}

        {/* Voice Feedback */}
        {lastCommand && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="text-cricket-primary h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">Last Command:</span>
            </div>
            <p className="text-gray-800">{lastCommand}</p>
          </div>
        )}

        {/* Quick Commands */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'runs', runs: 1, confidence: 1.0 })}
            className="bg-cricket-light hover:bg-cricket-primary hover:text-white"
          >
            Single
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'runs', runs: 4, confidence: 1.0 })}
            className="bg-cricket-light hover:bg-cricket-primary hover:text-white"
          >
            Four
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'runs', runs: 6, confidence: 1.0 })}
            className="bg-green-100 hover:bg-green-500 hover:text-white"
          >
            Six
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'extra', extraType: 'wide', extraRuns: 1, confidence: 1.0 })}
            className="bg-yellow-100 hover:bg-yellow-500 hover:text-white"
          >
            Wide
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'runs', runs: 0, confidence: 1.0 })}
            className="bg-gray-100 hover:bg-gray-500 hover:text-white"
          >
            Dot Ball
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'extra', extraType: 'noball', extraRuns: 1, confidence: 1.0 })}
            className="bg-orange-100 hover:bg-orange-500 hover:text-white"
          >
            No Ball
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'bowler_change', confidence: 1.0 })}
            className="bg-purple-100 hover:bg-purple-500 hover:text-white"
          >
            Change Bowler
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'over_complete', confidence: 1.0 })}
            className="bg-blue-100 hover:bg-blue-500 hover:text-white"
          >
            Over Complete
          </Button>
        </div>

        {/* Real-time transcript */}
        {isListening && transcript && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="text-sm font-medium text-blue-800">Live Transcript:</div>
            <div className="text-blue-700 italic">"{transcript}"</div>
          </div>
        )}

        {/* Status */}
        <div className="text-center text-sm text-gray-600 mb-4">
          {isListening && "🎤 Listening for cricket commands..."}
          {isProcessing && "⚡ Processing command..."}
          {!isListening && !isProcessing && "Click the microphone to start voice input"}
        </div>

        {/* Command Type Indicators when Listening */}
        {isListening && (
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Runs (0-6)</span>
            </div>
            <div className="flex items-center space-x-1 text-orange-600">
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
              <span>Extras</span>
            </div>
            <div className="flex items-center space-x-1 text-purple-600">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
              <span>Bowler change</span>
            </div>
            <div className="flex items-center space-x-1 text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span>Game flow</span>
            </div>
          </div>
        )}

        {/* Command Examples */}
        {!isListening && !isProcessing && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Voice Command Examples:</h4>
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
              <div className="bg-gray-50 p-2 rounded">
                <strong>Runs:</strong> "single", "four", "six", "dot ball", "three runs", "overthrow four"
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Extras:</strong> "wide", "no ball", "bye four", "leg bye two", "penalty five"
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Bowler:</strong> "change bowler", "Smith to bowl", "bring on spinner", "fast bowler on"
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Game Flow:</strong> "over complete", "timeout", "review", "rotate strike", "retire hurt"
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
