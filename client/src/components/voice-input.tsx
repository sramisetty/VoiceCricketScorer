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
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  const [interpretedCommand, setInterpretedCommand] = useState<string>('');
  const [commandType, setCommandType] = useState<string>('');

  useEffect(() => {
    if (transcript && !isListening && !isProcessing && transcript !== lastProcessedTranscript) {
      setIsProcessing(true);
      setLastProcessedTranscript(transcript);
      
      const command = parseCricketCommand(transcript);
      
      // Show what was interpreted
      let interpretedText = transcript;
      if (command.type === 'runs') {
        interpretedText = command.runs === 0 ? 'dot ball' : 
                        command.runs === 1 ? 'single' :
                        command.runs === 2 ? 'double' :
                        command.runs === 4 ? 'four' :
                        command.runs === 6 ? 'six' :
                        `${command.runs} runs`;
      } else if (command.type === 'extra') {
        interpretedText = `${command.extraType} ${command.extraRuns}`;
      }
      
      setInterpretedCommand(interpretedText);
      setCommandType(command.type);
      
      if (command.confidence > 0.5) {
        const commentary = generateCommentary(command, currentBatsman, currentBowler);
        setLastCommand(`"${transcript}" → ${interpretedText} - ${commentary}`);
        onCommand(command);
      } else {
        setLastCommand(`"${transcript}" - Command not recognized (confidence: ${Math.round(command.confidence * 100)}%)`);
      }
      
      resetTranscript();
      
      // Add delay to prevent rapid-fire commands
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000);
    }
  }, [transcript, isListening, isProcessing, lastProcessedTranscript, onCommand, currentBatsman, currentBowler, resetTranscript]);

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
    <Card className="mobile-card">
      <CardHeader className="mobile-padding">
        <CardTitle className="mobile-header text-gray-800">Voice Input</CardTitle>
      </CardHeader>
      <CardContent className="mobile-padding">
        {/* Voice Status */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Button
              onClick={handleMicClick}
              className={cn(
                "voice-button-mobile shadow-lg transition-all duration-200 transform hover:scale-105 touch-feedback",
                isListening 
                  ? "bg-red-500 hover:bg-red-600 active:bg-red-700" 
                  : "bg-cricket-primary hover:bg-cricket-secondary active:bg-cricket-dark"
              )}
              disabled={isProcessing}
            >
              {isListening ? (
                <MicOff className="text-white w-6 h-6 sm:w-8 sm:h-8" />
              ) : (
                <Mic className="text-white w-6 h-6 sm:w-8 sm:h-8" />
              )}
            </Button>
            {isListening && (
              <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
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

        {/* Command Interpretation */}
        {interpretedCommand && (
          <div className={cn(
            "rounded-lg p-4 mb-4",
            commandType === 'runs' ? "bg-green-50 border border-green-200" :
            commandType === 'extra' ? "bg-yellow-50 border border-yellow-200" :
            commandType === 'unknown' ? "bg-red-50 border border-red-200" :
            "bg-blue-50 border border-blue-200"
          )}>
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className={cn(
                "h-4 w-4",
                commandType === 'runs' ? "text-green-600" :
                commandType === 'extra' ? "text-yellow-600" :
                commandType === 'unknown' ? "text-red-600" :
                "text-blue-600"
              )} />
              <span className={cn(
                "text-sm font-medium",
                commandType === 'runs' ? "text-green-700" :
                commandType === 'extra' ? "text-yellow-700" :
                commandType === 'unknown' ? "text-red-700" :
                "text-blue-700"
              )}>
                Interpreted as:
              </span>
            </div>
            <p className={cn(
              "font-medium",
              commandType === 'runs' ? "text-green-800" :
              commandType === 'extra' ? "text-yellow-800" :
              commandType === 'unknown' ? "text-red-800" :
              "text-blue-800"
            )}>
              {interpretedCommand}
            </p>
          </div>
        )}

        {/* Voice Feedback */}
        {lastCommand && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="text-cricket-primary h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">Last Command:</span>
            </div>
            <p className="text-gray-800 text-sm">{lastCommand}</p>
          </div>
        )}

        {/* Quick Commands */}
        <div className="mobile-grid mb-6">
          <Button
            variant="outline"
            className="mobile-button touch-feedback bg-cricket-light hover:bg-cricket-primary hover:text-white mobile-text"
            onClick={() => onCommand({ type: 'runs', runs: 1, confidence: 1.0 })}
          >
            Single
          </Button>
          <Button
            variant="outline"
            className="mobile-button touch-feedback bg-cricket-light hover:bg-cricket-primary hover:text-white mobile-text"
            onClick={() => onCommand({ type: 'runs', runs: 4, confidence: 1.0 })}
          >
            Four
          </Button>
          <Button
            variant="outline"
            className="mobile-button touch-feedback bg-green-100 hover:bg-green-500 hover:text-white mobile-text"
            onClick={() => onCommand({ type: 'runs', runs: 6, confidence: 1.0 })}
          >
            Six
          </Button>
          <Button
            variant="outline"
            className="mobile-button touch-feedback bg-gray-100 hover:bg-gray-500 hover:text-white mobile-text"
            onClick={() => onCommand({ type: 'runs', runs: 0, confidence: 1.0 })}
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
