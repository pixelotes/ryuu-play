import { SimpleBotOptions } from '@ptcg/simple-bot';

export interface McBotOptions {
  /**
   * true  = "hard": playouts run on the real (unsanitized) state.
   * false = "easy"/honest: every playout runs on a determinized copy where
   *         all cards unknown to the bot are resampled (see determinize.ts).
   */
  cheat: boolean;
  /** Wall-clock budget per decision, in ms. The first round (one playout per
   * candidate) always completes, even if it overruns the budget. */
  timeBudgetMs: number;
  /** Hard cap on playouts per decision (0 = no cap, only the time budget). */
  maxPlayouts: number;
  /** Playout horizon, in turn changes after the current turn. 2 = stop when
   * the opponent's next turn is over (our next turn starts). */
  horizonTurns: number;
  /** Safety cap on actions dispatched per playout. */
  maxPlayoutSteps: number;
  /** SimpleBot's choice (candidate 0) is kept unless another candidate's
   * average score is higher by more than this (state-score points; a prize
   * is worth 1000). Guards against the greedy bias of the static score. */
  deviationMargin: number;
  /** Added to (or subtracted from) the state score on a win (or loss). */
  winBonus: number;
  /** Options of the underlying SimpleBot (tactics, prompt resolvers, scores),
   * used for candidate generation, playout policy and state evaluation. */
  simpleBot: SimpleBotOptions;
}
