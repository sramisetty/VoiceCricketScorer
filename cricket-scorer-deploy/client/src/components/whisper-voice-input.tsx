import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useWhisperVoice } from '@/hooks/use-whisper-voice';
import { parseCricketCommand, generateCommentary, type ParsedCommand } from '@/lib/cricket-parser';
import { cn } from '@/lib/utils';

interface WhisperVoiceInputProps {
  onCommand: (command: ParsedCommand) => void;
  currentBatsman?: string;
  currentBowler?: string;
}

export function WhisperVoiceInput({ onCommand, currentBatsman, currentBowler }: WhisperVoiceInputProps) {
  const { 
    isRecording, 
    transcript, 
    startRecording, 
    stopRecording, 
    resetTranscript, 
    isSupported,
    confidence,
    isProcessing,
    error
  } = useWhisperVoice();

  const [lastCommand, setLastCommand] = useState<string>('');
  const [interpretedCommand, setInterpretedCommand] = useState<string>('');
  const [commandType, setCommandType] = useState<string>('');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');

  useEffect(() => {
    if (transcript && transcript !== lastProcessedTranscript && !isProcessing) {
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
      
      // Clear transcript after processing
      setTimeout(() => {
        resetTranscript();
      }, 3000);
    }
  }, [transcript, lastProcessedTranscript, isProcessing, onCommand, currentBatsman, currentBowler, resetTranscript]);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            Voice recording is not supported in this browser
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Enhanced Voice Input (Whisper AI)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Voice Status */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Button
              onClick={handleMicClick}
              className={cn(
                "w-24 h-24 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-green-600 hover:bg-green-700"
              )}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="text-white text-2xl animate-spin" />
              ) : isRecording ? (
                <MicOff className="text-white text-2xl" />
              ) : (
                <Mic className="text-white text-2xl" />
              )}
            </Button>
            {isRecording && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Status Display */}
        <div className="text-center mb-4">
          {isRecording && (
            <p className="text-red-600 font-medium">🎤 Recording... Click to stop</p>
          )}
          {isProcessing && (
            <p className="text-blue-600 font-medium">🧠 Processing with AI...</p>
          )}
          {!isRecording && !isProcessing && (
            <p className="text-gray-600">Click microphone to start recording</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-red-600 font-medium">Error:</span>
            </div>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Current Transcript */}
        {transcript && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="text-blue-500 h-4 w-4" />
              <span className="text-sm font-medium text-blue-700">
                Whisper Transcription (Confidence: {Math.round(confidence * 100)}%):
              </span>
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
              <Volume2 className="text-green-600 h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">AI Result:</span>
            </div>
            <p className="text-gray-800 text-sm">{lastCommand}</p>
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
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-2">How to use:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Click microphone to start recording</li>
            <li>• Say cricket commands like "dot ball", "four runs", "six", "wide"</li>
            <li>• AI will process and interpret your speech</li>
            <li>• Much more accurate than browser speech recognition</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}