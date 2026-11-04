// Presentation time only: no attacks or damage are resolved during this sequence.
export const END_DURATION = 5.2;
// CPU mode always places the human on P1. Local/watch have no single "you".
export function roundOutcome(mode, winnerIndex) {
  if (winnerIndex == null || winnerIndex < 0)
    return { voice: "ready", headline: "NEXT BATTLE", lost: false };
  if (mode === "cpu") {
    const lost = winnerIndex === 1;
    return {
      voice: lost ? "loser" : "winner",
      headline: lost ? "YOU LOSE" : "YOU WIN",
      lost,
    };
  }
  return {
    voice: winnerIndex === 0 ? "p1win" : "p2win",
    headline: winnerIndex === 0 ? "PLAYER 1 WINS" : "PLAYER 2 WINS",
    lost: false,
  };
}
export function endingFrame(elapsed, knockout = true) {
  return {
    stage:
      elapsed < 0.28
        ? "impact"
        : elapsed < 1.15
          ? "fall"
          : elapsed < 3.1
            ? "ko"
            : "winner",
    fall: Math.max(0, Math.min(1, (elapsed - 0.28) / 0.87)),
    title: knockout ? "K.O." : "TIME OVER",
    done: elapsed >= END_DURATION,
  };
}
