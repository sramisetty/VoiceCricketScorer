export interface ParsedCommand {
  type: 'runs' | 'unknown';
  runs?: number;
  confidence: number;
}

const runPatterns = [
  /(?:(\d+)\s*)?runs?/i,
  /single/i,
  /double|two/i,
  /triple|three/i,
  /four|boundary/i,
  /six|maximum/i,
  /dot\s*ball|no\s*run|maiden/i,
  /(boundary|four)\s+through\s+(covers?|point|midwicket|third man|fine leg|backward point|square leg)/i,
  /(six|maximum)\s+(over|down|to)\s+(long on|long off|midwicket|square leg|deep cover|fine leg)/i,
  /(?:quick|fast)\s+single/i,
  /easy\s+(single|two|double)/i,
  /overthrow\s+(\d+)/i,
  /misfield\s+(\d+)\s+runs?/i
];

// Enhanced phonetic patterns for runs-only commands
const phoneticPatterns = {
  dot: ['dark', 'dot', 'dock', 'daft', 'dart', 'duck', 'dirt', 'dodge', 'not', 'got', 'dork', 'door', 'deep'],
  dotball: ['dot ball', 'dodge ball', 'not ball', 'dart ball', 'duck ball', 'dark ball', 'got ball', 'door ball', 'dock ball'],
  four: ['four', 'for', 'fore', 'fall', 'foul', 'floor', 'florence', 'ford', 'forest', 'fortune', 'forty', 'forth', 'force'],
  six: ['six', 'sick', 'sex', 'seeks', 'sickness', 'sixty', 'sixth', 'sixes', 'seeker', 'second', 'sector'],
  single: ['single', 'signal', 'simple', 'singer', 'single run', 'one run', 'one', 'won', 'wine', 'wonder'],
  double: ['double', 'trouble', 'dribble', 'rubble', 'two', 'to', 'too', 'tuple', 'couple', 'duo'],
  triple: ['triple', 'ripple', 'apple', 'three', 'tree', 'free', 'triples'],
  runs: ['runs', 'once', 'guns', 'ones', 'run', 'one', 'won', 'runs scored', 'run scored'],
  boundary: ['boundary', 'foundry', 'hungry', 'boundry', 'boundaries']
};

// Function to check phonetic similarity
function checkPhoneticMatch(text: string, patterns: string[]): boolean {
  const words = text.toLowerCase().split(/\s+/);
  return patterns.some(pattern => 
    words.some(word => 
      word.includes(pattern) || 
      pattern.includes(word) ||
      levenshteinDistance(word, pattern) <= 2
    )
  );
}

// Simple Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  if (str1.length < str2.length) {
    return levenshteinDistance(str2, str1);
  }

  if (str2.length === 0) {
    return str1.length;
  }

  const previousRow = Array.from({ length: str2.length + 1 }, (_, i) => i);
  
  for (let i = 0; i < str1.length; i++) {
    const currentRow = [i + 1];
    
    for (let j = 0; j < str2.length; j++) {
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + (str1[i] !== str2[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    
    previousRow.splice(0, previousRow.length, ...currentRow);
  }
  
  return previousRow[str2.length];
}

// Function to normalize misinterpreted speech
function normalizeTranscript(text: string): string {
  let normalized = text.toLowerCase();
  
  // Handle specific multi-word phrases first for runs
  normalized = normalized.replace(/\b(dodge|not|dart|duck|dark|got|door|dock)\s+ball\b/gi, 'dot ball');
  normalized = normalized.replace(/\b(florence|forest|fortune|forty|forth|force)\b/gi, 'four');
  normalized = normalized.replace(/\b(dark|dart|dock|dork|door|deep|got)\b/gi, 'dot');
  normalized = normalized.replace(/\b(sick|sex|seeks|sickness|sixty|sixth|seeker|second|sector)\b/gi, 'six');
  normalized = normalized.replace(/\b(signal|simple|singer|wonder|wine|won)\b/gi, 'single');
  normalized = normalized.replace(/\b(trouble|dribble|rubble|to|too|tuple|couple|duo)\b/gi, 'double');
  normalized = normalized.replace(/\b(ripple|apple|tree|free|triples)\b/gi, 'triple');
  
  // Handle run-related phrases
  normalized = normalized.replace(/\bone\s+run\b/gi, 'single');
  normalized = normalized.replace(/\btwo\s+runs?\b/gi, 'double');
  normalized = normalized.replace(/\bthree\s+runs?\b/gi, 'triple');
  normalized = normalized.replace(/\bfour\s+runs?\b/gi, 'four');
  normalized = normalized.replace(/\bsix\s+runs?\b/gi, 'six');
  normalized = normalized.replace(/\bmaximum\b/gi, 'six');
  normalized = normalized.replace(/\bboundary\b/gi, 'four');
  
  // Replace common misinterpretations
  Object.entries(phoneticPatterns).forEach(([correct, alternatives]) => {
    alternatives.forEach(alt => {
      if (alt !== correct) {
        const regex = new RegExp(`\\b${alt}\\b`, 'gi');
        normalized = normalized.replace(regex, correct);
      }
    });
  });
  
  return normalized;
}

export function parseCricketCommand(transcript: string): ParsedCommand {
  const originalText = transcript.toLowerCase().trim();
  const text = normalizeTranscript(originalText);
  let confidence = 0.7; // Base confidence
  
  // Boost confidence if we made phonetic corrections
  if (text !== originalText) {
    confidence = Math.min(confidence + 0.2, 0.95);
  }

  // RUNS ONLY - Check for runs with enhanced phonetic matching
  let runs = 0;
  let foundRuns = false;

  // Check for dot ball first
  if (/(?:dot\s*ball|no\s*run|maiden)/i.test(text) || 
      checkPhoneticMatch(text, phoneticPatterns.dot) || 
      checkPhoneticMatch(text, phoneticPatterns.dotball)) {
    runs = 0;
    foundRuns = true;
    confidence = 0.9;
  }
  // Check for single
  else if (/single|(?:one\s+run)|(?:quick|fast)\s+single/i.test(text) || 
           checkPhoneticMatch(text, phoneticPatterns.single)) {
    runs = 1;
    foundRuns = true;
    confidence = 0.95;
  }
  // Check for double/two
  else if (/(?:double|two|easy\s+two)/i.test(text) || 
           checkPhoneticMatch(text, phoneticPatterns.double)) {
    runs = 2;
    foundRuns = true;
    confidence = 0.95;
  }
  // Check for triple/three
  else if (/(?:triple|three)/i.test(text) || 
           checkPhoneticMatch(text, phoneticPatterns.triple)) {
    runs = 3;
    foundRuns = true;
    confidence = 0.95;
  }
  // Check for four/boundary
  else if (/(?:four|boundary)/i.test(text) || 
           checkPhoneticMatch(text, phoneticPatterns.four) || 
           checkPhoneticMatch(text, phoneticPatterns.boundary)) {
    runs = 4;
    foundRuns = true;
    confidence = 0.98;
  }
  // Check for six/maximum
  else if (/(?:six|maximum)/i.test(text) || 
           checkPhoneticMatch(text, phoneticPatterns.six)) {
    runs = 6;
    foundRuns = true;
    confidence = 0.98;
  }
  // Check for overthrow patterns
  else if (/overthrow\s+(\d+)/i.test(text)) {
    const overthrowMatch = text.match(/overthrow\s+(\d+)/i);
    runs = overthrowMatch ? parseInt(overthrowMatch[1]) : 4;
    foundRuns = true;
    confidence = 0.85;
  }
  // Check for misfield patterns
  else if (/misfield\s+(\d+)\s+runs?/i.test(text)) {
    const misfieldMatch = text.match(/misfield\s+(\d+)\s+runs?/i);
    runs = misfieldMatch ? parseInt(misfieldMatch[1]) : 2;
    foundRuns = true;
    confidence = 0.85;
  }
  // Check for explicit number with runs
  else {
    const runsMatch = text.match(/(\d+)\s*runs?/i);
    if (runsMatch) {
      runs = parseInt(runsMatch[1]);
      foundRuns = true;
      confidence = 0.9;
    }
  }

  if (foundRuns) {
    return {
      type: 'runs',
      runs,
      confidence
    };
  }

  // If no runs pattern matched, return unknown
  return {
    type: 'unknown',
    confidence: 0.3
  };
}

export function generateCommentary(command: ParsedCommand, playerName?: string, bowlerName?: string): string {
  const player = playerName || 'Batsman';
  const bowler = bowlerName || 'Bowler';

  switch (command.type) {
    case 'runs':
      if (command.runs === 0) {
        return `${bowler} to ${player}, dot ball - no run scored`;
      } else if (command.runs === 1) {
        return `${bowler} to ${player}, single run taken`;
      } else if (command.runs === 2) {
        return `${bowler} to ${player}, two runs taken with good running`;
      } else if (command.runs === 3) {
        return `${bowler} to ${player}, three runs! Excellent running between the wickets`;
      } else if (command.runs === 4) {
        return `${bowler} to ${player}, FOUR! Beautiful boundary shot`;
      } else if (command.runs === 6) {
        return `${bowler} to ${player}, SIX! Maximum! What a shot!`;
      } else {
        return `${bowler} to ${player}, ${command.runs} runs taken`;
      }

    default:
      return `${bowler} to ${player}`;
  }
}