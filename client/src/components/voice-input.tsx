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
            onClick={() => onCommand({ type: 'wicket', isWicket: true, wicketType: 'caught', confidence: 1.0 })}
            className="bg-red-100 hover:bg-red-500 hover:text-white"
          >
            Wicket
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand({ type: 'extra', extraType: 'wide', extraRuns: 1, confidence: 1.0 })}
            className="bg-yellow-100 hover:bg-yellow-500 hover:text-white"
          >
            Wide
          </Button>
        </div>

        {/* Status */}
        <div className="text-center text-sm text-gray-600">
          {isListening && "🎤 Listening for cricket commands..."}
          {isProcessing && "⚡ Processing command..."}
          {!isListening && !isProcessing && "Click the microphone to start voice input"}
        </div>
      </CardContent>
    </Card>
  );
}
