import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Volume2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { parseCricketCommand, generateCommentary, type ParsedCommand } from '@/lib/cricket-parser';
import { cn } from '@/lib/utils';

interface EnhancedVoiceInputProps {
  onCommand: (command: ParsedCommand) => void;
  currentBatsman?: string;
  currentBowler?: string;
}

export function EnhancedVoiceInput({ onCommand, currentBatsman, currentBowler }: EnhancedVoiceInputProps) {
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    resetTranscript, 
    browserSupportsSpeechRecognition 
  } = useVoiceRecognition();

  const [lastCommand, setLastCommand] = useState<string>('');
  const [interpretedCommand, setInterpretedCommand] = useState<string>('');
  const [commandType, setCommandType] = useState<string>('');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced phonetic correction patterns
  const phoneticCorrections = {
    'dark': 'dot',
    'dart': 'dot',
    'not': 'dot',
    'got': 'dot',
    'florence': 'four',
    'floor': 'four',
    'for': 'four',
    'sex': 'six',
    'sicks': 'six',
    'wide ball': 'wide',
    'no ball': 'no ball',
    'by ball': 'bye',
    'leg by': 'leg bye',
    'single run': 'single',
    'one run': 'single',
    'two runs': 'double',
    'three runs': 'three',
    'four runs': 'four',
    'six runs': 'six',
    'maximum': 'six',
    'boundary': 'four'
  };

  const applyPhoneticCorrection = (text: string): string => {
    let corrected = text.toLowerCase();
    
    // Apply phonetic corrections
    for (const [incorrect, correct] of Object.entries(phoneticCorrections)) {
      const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    }
    
    return corrected;
  };

  useEffect(() => {
    if (transcript && transcript !== lastProcessedTranscript) {
      setLastProcessedTranscript(transcript);
      
      // Apply phonetic corrections
      const correctedTranscript = applyPhoneticCorrection(transcript);
      
      const command = parseCricketCommand(correctedTranscript);
      
      // Show what was interpreted
      let interpretedText = correctedTranscript;
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
  }, [transcript, lastProcessedTranscript, onCommand, currentBatsman, currentBowler, resetTranscript]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p>Voice recognition is not supported in this browser</p>
            <p className="text-sm">Please use Chrome, Edge, or Safari for voice input</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
          Enhanced Voice Input
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
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
                isListening 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-green-600 hover:bg-green-700"
              )}
            >
              {isListening ? (
                <MicOff className="text-white text-2xl" />
              ) : (
                <Mic className="text-white text-2xl" />
              )}
            </Button>
            {isListening && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Status Display */}
        <div className="text-center mb-4">
          {isListening ? (
            <p className="text-red-600 font-medium">🎤 Listening... Click to stop</p>
          ) : (
            <p className="text-gray-600">Click microphone to start voice input</p>
          )}
        </div>

        {/* Current Transcript */}
        {transcript && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="text-blue-500 h-4 w-4" />
              <span className="text-sm font-medium text-blue-700">
                Browser Speech Recognition:
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
                Enhanced Recognition:
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
              <span className="text-sm font-medium text-gray-700">Result:</span>
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
            <li>• Click microphone to start voice recognition</li>
            <li>• Say commands like "dot ball", "four runs", "six", "wide"</li>
            <li>• Enhanced phonetic correction handles misheard words</li>
            <li>• {isOnline ? "Online mode active" : "Offline mode - basic recognition only"}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}