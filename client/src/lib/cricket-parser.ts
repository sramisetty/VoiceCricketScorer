export interface ParsedCommand {
  type: 'runs' | 'extra' | 'correction' | 'bowler_change' | 'batsman_change' | 'strike_rotation' | 'over_complete' | 'timeout' | 'review' | 'unknown';
  runs?: number;
  extraType?: 'wide' | 'noball' | 'bye' | 'legbye' | 'penalty';
  extraRuns?: number;
  playerName?: string;
  newPlayerName?: string;
  bowlerName?: string;
  batsmanName?: string;
  action?: 'change' | 'retire' | 'injury' | 'next' | 'switch';
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

const extraPatterns = [
  /wide(?:\s*ball)?/i,
  /no\s*ball/i,
  /bye/i,
  /leg\s*bye/i,
  /(wide|no ball)\s+(\d+)\s+runs?/i, // "wide 2 runs"
  /(bye|leg bye)\s+(\d+)/i, // "bye 4"
  /penalty\s+(\d+)/i, // "penalty 5"
  /dead\s+ball/i,
  /short\s+run/i,
  /free\s+hit/i,
  /beamer/i,
  /bouncer/i,
  /full\s+toss/i
];

const bowlerPatterns = [
  /(?:change|new|next|switch)\s+bowl(?:er|ing)?/i,
  /(?:bowl(?:er|ing)?)\s+(?:change|switch|new)/i,
  /([A-Za-z\s]+)\s+to\s+bowl/i,
  /([A-Za-z\s]+)\s+from\s+(?:the\s+)?(other\s+end|pavilion\s+end|city\s+end)/i,
  /bring\s+on\s+([A-Za-z\s]+)/i,
  /spinner\s+on/i,
  /fast\s+bowler\s+on/i,
  /medium\s+pacer\s+on/i
];

const batsmanPatterns = [
  /(?:change|new|next|switch)\s+bats(?:man|men)?/i,
  /([A-Za-z\s]+)\s+(?:to\s+)?(?:bat|crease|come)/i,
  /(?:retire|retired)\s+(?:hurt|injured)?/i,
  /([A-Za-z\s]+)\s+retire(?:s|d)?/i,
  /next\s+(?:man\s+)?in/i,
  /new\s+bats(?:man|men)/i
];

const strikeRotationPatterns = [
  /(?:change|switch|rotate)\s+strike/i,
  /batsmen\s+cross/i,
  /(?:swap|switch)\s+(?:ends|batsmen)/i,
  /strike\s+to\s+([A-Za-z\s]+)/i,
  /([A-Za-z\s]+)\s+(?:on\s+)?strike/i
];

const overPatterns = [
  /over\s+(?:complete|finished|done)/i,
  /end\s+of\s+over/i,
  /new\s+over/i,
  /over\s+(\d+)/i,
  /that's\s+the\s+over/i
];

const gameFlowPatterns = [
  /time\s*out/i,
  /(?:drinks|water)\s+break/i,
  /review/i,
  /(?:drs|decision\s+review)/i,
  /(?:third\s+)?umpire/i,
  /(?:ultra|hot)\s*edge/i,
  /(?:hawk\s*eye|ball\s+tracking)/i,
  /(?:snick|edge)o\s*meter/i
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

  // Check for game flow commands (timeout, review, etc.)
  for (const pattern of gameFlowPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (/time\s*out|drinks|water/i.test(text)) {
        return {
          type: 'timeout',
          confidence: 0.9
        };
      } else if (/review|drs|umpire|hawk|edge|tracking/i.test(text)) {
        return {
          type: 'review',
          confidence: 0.9
        };
      }
    }
  }

  // Check for over completion
  for (const pattern of overPatterns) {
    const match = text.match(pattern);
    if (match) {
      const overMatch = text.match(/over\s+(\d+)/i);
      return {
        type: 'over_complete',
        confidence: 0.9,
        playerName: overMatch ? overMatch[1] : undefined
      };
    }
  }

  // Check for strike rotation
  for (const pattern of strikeRotationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const playerMatch = text.match(/(?:strike\s+to\s+|([A-Za-z\s]+)\s+(?:on\s+)?strike)/i);
      return {
        type: 'strike_rotation',
        playerName: playerMatch ? playerMatch[1]?.trim() : undefined,
        confidence: 0.85
      };
    }
  }

  // Check for batsman changes
  for (const pattern of batsmanPatterns) {
    const match = text.match(pattern);
    if (match) {
      const playerMatch = text.match(/([A-Za-z\s]+)\s+(?:to\s+)?(?:bat|crease|come|retire)/i);
      let action: ParsedCommand['action'] = 'change';
      
      if (/retire/i.test(text)) action = 'retire';
      else if (/hurt|injured/i.test(text)) action = 'injury';
      else if (/next/i.test(text)) action = 'next';
      
      return {
        type: 'batsman_change',
        action,
        newPlayerName: playerMatch ? playerMatch[1].trim() : undefined,
        confidence: 0.85
      };
    }
  }

  // Check for bowler changes
  for (const pattern of bowlerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const playerMatch = text.match(/([A-Za-z\s]+)\s+(?:to\s+bowl|from)/i) || 
                         text.match(/bring\s+on\s+([A-Za-z\s]+)/i);
      return {
        type: 'bowler_change',
        bowlerName: playerMatch ? playerMatch[1].trim() : undefined,
        confidence: 0.85
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
      else if (/penalty/i.test(text)) extraType = 'penalty';

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

  if (/single|(?:quick|fast)\s+single/i.test(text)) {
    runs = 1;
    foundRuns = true;
    confidence = 0.9;
  } else if (/(?:double|two|easy\s+single)/i.test(text)) {
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
  } else if (/(?:dot\s*ball|no\s*run|maiden)/i.test(text)) {
    runs = 0;
    foundRuns = true;
    confidence = 0.85;
  } else if (/overthrow\s+(\d+)/i.test(text)) {
    const overthrowMatch = text.match(/overthrow\s+(\d+)/i);
    runs = overthrowMatch ? parseInt(overthrowMatch[1]) : 4;
    foundRuns = true;
    confidence = 0.8;
  } else if (/misfield\s+(\d+)\s+runs?/i.test(text)) {
    const misfieldMatch = text.match(/misfield\s+(\d+)\s+runs?/i);
    runs = misfieldMatch ? parseInt(misfieldMatch[1]) : 2;
    foundRuns = true;
    confidence = 0.8;
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

    case 'extra':
      switch (command.extraType) {
        case 'wide':
          return `${bowler} bowls a WIDE, ${command.extraRuns} extra runs added to the total`;
        case 'noball':
          return `${bowler} bowls a NO BALL, ${command.extraRuns} extra runs and free hit coming up`;
        case 'bye':
          return `Bye taken, ${command.extraRuns} runs to the total as the ball beats everyone`;
        case 'legbye':
          return `Leg bye taken, ${command.extraRuns} runs to the total off the batsman's pad`;
        case 'penalty':
          return `Penalty runs awarded, ${command.extraRuns} runs added to the batting team's total`;
        default:
          return `Extra runs added to the total`;
      }

    case 'bowler_change':
      const newBowler = command.bowlerName || 'New bowler';
      return `Bowling change: ${newBowler} comes into the attack`;

    case 'batsman_change':
      const newBatsman = command.newPlayerName || 'New batsman';
      switch (command.action) {
        case 'retire':
          return `${player} retires from the crease. ${newBatsman} walks out to bat`;
        case 'injury':
          return `${player} retires hurt. ${newBatsman} comes out as the replacement`;
        case 'next':
          return `${newBatsman} walks out to the crease as the next batsman`;
        default:
          return `Batting change: ${newBatsman} comes out to bat`;
      }

    case 'strike_rotation':
      const newStriker = command.playerName || 'Batsman';
      return `Strike rotation: ${newStriker} is now facing the bowling`;

    case 'over_complete':
      return `That's the end of the over. ${command.playerName ? `Over ${command.playerName} completed` : 'Over completed'}`;

    case 'timeout':
      return `Timeout called. Players are taking a break for drinks/strategy`;

    case 'review':
      return `Review taken! Decision has been referred to the third umpire`;

    case 'correction':
      return `Correction requested - previous entry needs to be amended`;

    default:
      return `${bowler} to ${player}`;
  }
}
