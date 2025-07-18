export interface ParsedCommand {
  type: 'runs' | 'wicket' | 'extra' | 'correction' | 'bowler_change' | 'unknown';
  runs?: number;
  extraType?: 'wide' | 'noball' | 'bye' | 'legbye';
  extraRuns?: number;
  wicketType?: 'bowled' | 'caught' | 'lbw' | 'runout' | 'stumped' | 'hitwicket';
  playerName?: string;
  isWicket?: boolean;
  confidence: number;
}

const runPatterns = [
  /(?:(\d+)\s*)?runs?/i,
  /single/i,
  /double|two/i,
  /triple|three/i,
  /four|boundary/i,
  /six|maximum/i,
  /dot\s*ball|no\s*run/i,
  /(\d+)\s+(runs?)?\s*(and\s+)?(wicket|out)/i, // "2 runs and wicket"
  /(four|six)\s+(runs?)?\s*(and\s+)?(wicket|out)/i, // "four and wicket"
  /(boundary|four)\s+through\s+(covers?|point|midwicket|third man|fine leg)/i,
  /(six|maximum)\s+(over|down|to)\s+(long on|long off|midwicket|square leg)/i
];

const extraPatterns = [
  /wide(?:\s*ball)?/i,
  /no\s*ball/i,
  /bye/i,
  /leg\s*bye/i,
  /(wide|no ball)\s+(\d+)\s+runs?/i, // "wide 2 runs"
  /(bye|leg bye)\s+(\d+)/i, // "bye 4"
  /penalty\s+(\d+)/i // "penalty 5"
];

const wicketPatterns = [
  /(?:out|wicket|bowled|caught|lbw|run\s*out|stumped|hit\s*wicket)/i,
  /(?:clean\s*)?bowled/i,
  /caught/i,
  /lbw/i,
  /run\s*out/i,
  /stumped/i,
  /hit\s*wicket/i
];

const correctionPatterns = [
  /(?:correction|change|undo|wrong)/i,
  /instead\s*of/i,
  /actually/i
];

const playerNamePatterns = [
  /(?:to|for|by)\s+([A-Za-z\s]+?)(?:\s|$|,)/i,
  /([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(?:to\s+)?(?:face|facing|bowl|bowling)/i
];

export function parseCricketCommand(transcript: string): ParsedCommand {
  const text = transcript.toLowerCase().trim();
  let confidence = 0.7; // Base confidence

  // Check for corrections first
  if (correctionPatterns.some(pattern => pattern.test(text))) {
    return {
      type: 'correction',
      confidence: 0.8
    };
  }

  // Check for wickets
  for (const pattern of wicketPatterns) {
    const match = text.match(pattern);
    if (match) {
      let wicketType: ParsedCommand['wicketType'] = 'caught';
      
      if (/bowled/i.test(text)) wicketType = 'bowled';
      else if (/caught/i.test(text)) wicketType = 'caught';
      else if (/lbw/i.test(text)) wicketType = 'lbw';
      else if (/run\s*out/i.test(text)) wicketType = 'runout';
      else if (/stumped/i.test(text)) wicketType = 'stumped';
      else if (/hit\s*wicket/i.test(text)) wicketType = 'hitwicket';

      const playerMatch = text.match(playerNamePatterns[0]);
      const playerName = playerMatch ? playerMatch[1].trim() : undefined;

      return {
        type: 'wicket',
        isWicket: true,
        wicketType,
        playerName,
        confidence: 0.9
      };
    }
  }

  // Check for extras
  for (const pattern of extraPatterns) {
    const match = text.match(pattern);
    if (match) {
      let extraType: ParsedCommand['extraType'] = 'wide';
      
      if (/wide/i.test(text)) extraType = 'wide';
      else if (/no\s*ball/i.test(text)) extraType = 'noball';
      else if (/leg\s*bye/i.test(text)) extraType = 'legbye';
      else if (/bye/i.test(text)) extraType = 'bye';

      // Extract extra runs
      const runsMatch = text.match(/(\d+)/);
      const extraRuns = runsMatch ? parseInt(runsMatch[1]) : 1;

      return {
        type: 'extra',
        extraType,
        extraRuns,
        runs: extraType === 'wide' || extraType === 'noball' ? extraRuns : 0,
        confidence: 0.85
      };
    }
  }

  // Check for runs
  let runs = 0;
  let foundRuns = false;

  if (/single/i.test(text)) {
    runs = 1;
    foundRuns = true;
    confidence = 0.9;
  } else if (/(?:double|two)/i.test(text)) {
    runs = 2;
    foundRuns = true;
    confidence = 0.9;
  } else if (/(?:triple|three)/i.test(text)) {
    runs = 3;
    foundRuns = true;
    confidence = 0.9;
  } else if (/(?:four|boundary)/i.test(text)) {
    runs = 4;
    foundRuns = true;
    confidence = 0.95;
  } else if (/(?:six|maximum)/i.test(text)) {
    runs = 6;
    foundRuns = true;
    confidence = 0.95;
  } else if (/(?:dot\s*ball|no\s*run)/i.test(text)) {
    runs = 0;
    foundRuns = true;
    confidence = 0.85;
  } else {
    // Look for explicit number
    const runsMatch = text.match(/(\d+)\s*runs?/i);
    if (runsMatch) {
      runs = parseInt(runsMatch[1]);
      foundRuns = true;
      confidence = 0.8;
    }
  }

  if (foundRuns) {
    const playerMatch = text.match(playerNamePatterns[0]);
    const playerName = playerMatch ? playerMatch[1].trim() : undefined;

    return {
      type: 'runs',
      runs,
      playerName,
      confidence
    };
  }

  // Check for bowler change
  if (/(?:change|new|next)\s*bowl/i.test(text) || /bowl/i.test(text)) {
    return {
      type: 'bowler_change',
      confidence: 0.7
    };
  }

  return {
    type: 'unknown',
    confidence: 0.1
  };
}

export function generateCommentary(command: ParsedCommand, playerName?: string, bowlerName?: string): string {
  const player = playerName || command.playerName || 'Batsman';
  const bowler = bowlerName || 'Bowler';

  switch (command.type) {
    case 'runs':
      if (command.runs === 0) {
        return `${bowler} to ${player}, dot ball - no run scored`;
      } else if (command.runs === 1) {
        return `${bowler} to ${player}, single run taken`;
      } else if (command.runs === 4) {
        return `${bowler} to ${player}, FOUR! Beautiful boundary shot`;
      } else if (command.runs === 6) {
        return `${bowler} to ${player}, SIX! Maximum! What a shot!`;
      } else {
        return `${bowler} to ${player}, ${command.runs} runs taken`;
      }

    case 'wicket':
      let wicketText = '';
      switch (command.wicketType) {
        case 'bowled':
          wicketText = 'BOWLED! Timber! The stumps are shattered';
          break;
        case 'caught':
          wicketText = 'CAUGHT! Excellent catch taken';
          break;
        case 'lbw':
          wicketText = 'LBW! The umpire raises the finger';
          break;
        case 'runout':
          wicketText = 'RUN OUT! Direct hit and the batsman is short';
          break;
        case 'stumped':
          wicketText = 'STUMPED! Lightning quick work by the keeper';
          break;
        default:
          wicketText = 'OUT! The batsman has to go';
      }
      return `${bowler} to ${player}, ${wicketText}`;

    case 'extra':
      switch (command.extraType) {
        case 'wide':
          return `${bowler} bowls a WIDE, ${command.extraRuns} extra runs`;
        case 'noball':
          return `${bowler} bowls a NO BALL, ${command.extraRuns} extra runs`;
        case 'bye':
          return `Bye taken, ${command.extraRuns} runs to the total`;
        case 'legbye':
          return `Leg bye taken, ${command.extraRuns} runs to the total`;
        default:
          return `Extra runs to the total`;
      }

    default:
      return `${bowler} to ${player}`;
  }
}
