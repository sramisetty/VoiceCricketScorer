/**
 * ICC Cricket Rules Engine
 * Implements official ICC Playing Conditions 2019-20
 */

import { Ball, InsertBall, PlayerStats } from "@shared/schema";

export interface CricketRuleValidation {
  isValid: boolean;
  errorMessage?: string;
  adjustedBall?: Partial<InsertBall>;
  penaltyRuns?: number;
}

export interface CricketRuleEngine {
  // ICC Rule 17: The Over
  validateOver(balls: Ball[], newBall: InsertBall): CricketRuleValidation;
  
  // ICC Rule 18: Scoring Runs
  validateScoringRuns(ball: InsertBall): CricketRuleValidation;
  
  // ICC Rule 21: No Ball
  validateNoBall(ball: InsertBall): CricketRuleValidation;
  
  // ICC Rule 22: Wide Ball  
  validateWideBall(ball: InsertBall): CricketRuleValidation;
  
  // ICC Rule 18.4/18.5: Short Runs
  validateShortRuns(ball: InsertBall): CricketRuleValidation;
  
  // ICC Rule 20: Dead Ball
  validateDeadBall(ball: InsertBall): CricketRuleValidation;
  
  // ICC Rule 17.6: Bowler consecutive overs
  validateBowlerConsecutiveOvers(previousOverBowlerId: number | null, currentBowlerId: number): CricketRuleValidation;
  
  // ICC Rule 18.6: Penalty Runs
  calculatePenaltyRuns(ball: InsertBall): number;
}

export class ICCRuleEngine implements CricketRuleEngine {
  
  /**
   * ICC Rule 17: The Over - 6 valid balls per over
   */
  validateOver(balls: Ball[], newBall: InsertBall): CricketRuleValidation {
    const overBalls = balls.filter(b => 
      b.overNumber === newBall.overNumber && 
      !b.extraType // Only count valid balls (not wides/no-balls)
    );
    
    if (overBalls.length >= 6) {
      return {
        isValid: false,
        errorMessage: "ICC Rule 17: Over is complete. Maximum 6 valid balls per over."
      };
    }
    
    // Auto-adjust ball number for extras
    if (newBall.extraType === 'wide' || newBall.extraType === 'noball') {
      // Extras don't advance ball number
      return {
        isValid: true,
        adjustedBall: {
          ...newBall,
          ballNumber: overBalls.length + 1 // Keep same ball number
        }
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * ICC Rule 18: Scoring Runs - Valid run scoring
   */
  validateScoringRuns(ball: InsertBall): CricketRuleValidation {
    const runs = ball.runs || 0;
    const extraRuns = ball.extraRuns || 0;
    
    // ICC Rule 18.1: Valid runs are 0-6 for normal scoring
    if (runs < 0 || runs > 6) {
      return {
        isValid: false,
        errorMessage: "ICC Rule 18: Runs must be between 0 and 6."
      };
    }
    
    // ICC Rule 18.1.2: Boundaries are 4 or 6 runs
    if (runs === 4 || runs === 6) {
      // This is a boundary - no running between wickets
      return {
        isValid: true,
        adjustedBall: {
          ...ball,
          commentary: runs === 4 ? "Boundary! Four runs" : "Maximum! Six runs"
        }
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * ICC Rule 21: No Ball
   */
  validateNoBall(ball: InsertBall): CricketRuleValidation {
    if (ball.extraType === 'noball') {
      // ICC Rule 21: No ball gives 1 penalty run + any runs scored
      return {
        isValid: true,
        adjustedBall: {
          ...ball,
          extraRuns: 1, // Automatic 1 penalty run
          commentary: `No ball! ${1 + (ball.runs || 0)} total runs`
        },
        penaltyRuns: 1
      };
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule 22: Wide Ball
   */
  validateWideBall(ball: InsertBall): CricketRuleValidation {
    if (ball.extraType === 'wide') {
      // ICC Rule 22: Wide ball gives 1 penalty run + any runs scored by running
      return {
        isValid: true,
        adjustedBall: {
          ...ball,
          extraRuns: 1, // Automatic 1 penalty run
          commentary: `Wide ball! ${1 + (ball.runs || 0)} total runs`
        },
        penaltyRuns: 1
      };
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule 18.4/18.5: Short Runs (Unintentional/Deliberate)
   */
  validateShortRuns(ball: InsertBall): CricketRuleValidation {
    if (ball.isShortRun) {
      // ICC Rule 18.4: Unintentional short runs are not scored
      // ICC Rule 18.5: Deliberate short runs incur 5-run penalty
      const penaltyRuns = ball.penaltyRuns || 0;
      
      if (penaltyRuns === 5) {
        // Deliberate short run
        return {
          isValid: true,
          adjustedBall: {
            ...ball,
            runs: 0, // Runs disallowed
            commentary: "Deliberate short run! 5-run penalty to fielding side"
          },
          penaltyRuns: 5
        };
      } else {
        // Unintentional short run
        return {
          isValid: true,
          adjustedBall: {
            ...ball,
            commentary: "Short run called - run not counted"
          }
        };
      }
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule 20: Dead Ball
   */
  validateDeadBall(ball: InsertBall): CricketRuleValidation {
    if (ball.isDeadBall) {
      // ICC Rule 20: Dead ball - no runs scored, ball not counted
      return {
        isValid: true,
        adjustedBall: {
          ...ball,
          runs: 0,
          extraRuns: 0,
          commentary: "Dead ball called"
        }
      };
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule 17.6: Bowler cannot bowl consecutive overs
   */
  validateBowlerConsecutiveOvers(previousOverBowlerId: number | null, currentBowlerId: number): CricketRuleValidation {
    if (previousOverBowlerId && previousOverBowlerId === currentBowlerId) {
      return {
        isValid: false,
        errorMessage: "ICC Rule 17.6: Same bowler cannot bowl consecutive overs"
      };
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule 18.6: Calculate penalty runs
   */
  calculatePenaltyRuns(ball: InsertBall): number {
    let penalty = 0;
    
    // No ball and wide automatic penalties
    if (ball.extraType === 'noball' || ball.extraType === 'wide') {
      penalty += 1;
    }
    
    // Deliberate short run penalty
    if (ball.isShortRun && ball.penaltyRuns === 5) {
      penalty += 5;
    }
    
    // Other 5-run penalties (helmet hit, etc.)
    if (ball.penaltyRuns && ball.penaltyRuns === 5) {
      penalty += 5;
    }
    
    return penalty;
  }
  
  /**
   * ICC Rule: Strike rotation at end of over
   */
  validateStrikeRotationEndOfOver(overNumber: number, ballNumber: number): boolean {
    // At end of over (6th ball), non-striker becomes striker for next over
    return ballNumber === 6;
  }
  
  /**
   * ICC Rule: Maximum 10 wickets per innings
   */
  validateWicketLimit(currentWickets: number): CricketRuleValidation {
    if (currentWickets >= 10) {
      return {
        isValid: false,
        errorMessage: "ICC Rule: Maximum 10 wickets per innings. Team is all out."
      };
    }
    return { isValid: true };
  }
  
  /**
   * ICC Rule: Validate dismissal types
   */
  validateDismissalType(wicketType: string): CricketRuleValidation {
    const validDismissals = [
      'bowled', 'caught', 'lbw', 'run_out', 'stumped', 
      'hit_wicket', 'handled_ball', 'obstructing_field', 
      'timed_out', 'hit_ball_twice'
    ];
    
    if (!validDismissals.includes(wicketType)) {
      return {
        isValid: false,
        errorMessage: `ICC Rule: Invalid dismissal type '${wicketType}'`
      };
    }
    
    return { isValid: true };
  }
}

export const cricketRules = new ICCRuleEngine();